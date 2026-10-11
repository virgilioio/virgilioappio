-- Find, Phase 0 (2026-10-11, approved by Allan): stop the data loss, the
-- duplicates and the credit drift before the internal-first search.
--
-- 1. Identity helpers: a LinkedIn profile's slug, and one lookup that finds a
--    workspace's candidate by Apollo id, LinkedIn or email.
-- 2. One candidate per Apollo id in a workspace.
-- 3. sourcing_project_candidates: a project's shortlist / not a fit / archive
--    and collect state, kept apart from the search cache so a refresh never
--    loses work. Keyed by identity (Apollo id, then candidate).
-- 4. Apollo credits as Apollo bills them: a plan per workspace (credits a
--    month, the day the cycle renews) and a ledger of what each call cost.
--    apollo_credit_status() is the one place both the server and the app
--    read the balance from.
--
-- No foreign keys on the state table's project and candidate columns: a
-- project or candidate removed later leaves a state row nobody reads, rather
-- than blocking the removal. Readers join and skip rows that point nowhere.

-- ── 1. Identity helpers ────────────────────────────────────────────────────

create or replace function public.linkedin_slug(p_url text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_url ~* 'linkedin\.com/(in|pub)/[^/?#]+'
      then nullif(lower(substring(p_url from '(?i)linkedin\.com/(?:in|pub)/([^/?#]+)')), '')
  end
$$;

comment on function public.linkedin_slug(text) is
  'The profile slug of a LinkedIn URL (no protocol, www./country prefix, query or trailing slash), lower-case; null when the text is not a LinkedIn profile URL.';

create index if not exists candidates_tenant_linkedin_slug_idx
  on public.candidates (tenant_id, public.linkedin_slug(linkedin_url));

create index if not exists candidates_tenant_email_lower_idx
  on public.candidates (tenant_id, lower(btrim(email)));

create or replace function public.find_tenant_candidate(
  p_tenant uuid,
  p_apollo_id text,
  p_linkedin text,
  p_email text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.candidates c
  where c.tenant_id = p_tenant
    and c.deleted_at is null
    and c.merged_into is null
    and (
      (nullif(p_apollo_id, '') is not null and c.apollo_id = p_apollo_id)
      or (public.linkedin_slug(p_linkedin) is not null
          and public.linkedin_slug(c.linkedin_url) = public.linkedin_slug(p_linkedin))
      or (nullif(btrim(p_email), '') is not null
          and lower(btrim(c.email)) = lower(btrim(p_email)))
    )
  order by
    (c.apollo_id is not distinct from nullif(p_apollo_id, '')) desc,
    (public.linkedin_slug(c.linkedin_url) is not distinct from public.linkedin_slug(p_linkedin)) desc,
    c.updated_at desc
  limit 1
$$;

comment on function public.find_tenant_candidate(uuid, text, text, text) is
  'The workspace candidate a collect or enrichment belongs to: same Apollo id first, then same LinkedIn profile, then same email. Server only.';

revoke all on function public.find_tenant_candidate(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.find_tenant_candidate(uuid, text, text, text) to service_role;

-- ── 2. One candidate per Apollo id in a workspace ──────────────────────────

create unique index if not exists candidates_tenant_apollo_id_key
  on public.candidates (tenant_id, apollo_id)
  where apollo_id is not null and deleted_at is null and merged_into is null;

-- ── 3. Project state, apart from the search cache ──────────────────────────

create table if not exists public.sourcing_project_candidates (
  id uuid primary key default gen_random_uuid(),
  sourcing_project_id uuid not null,
  tenant_id uuid not null,
  apollo_id text,
  candidate_id uuid,
  status text not null default 'active'
    check (status in ('active', 'shortlisted', 'not_a_fit', 'archived')),
  status_changed_at timestamptz,
  status_changed_by uuid,
  collected_at timestamptz,
  collected_by uuid,
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sourcing_project_candidates_identity
    check (apollo_id is not null or candidate_id is not null)
);

comment on table public.sourcing_project_candidates is
  'What a sourcing project did with a person (shortlist, not a fit, archive, collect), keyed by identity and kept across search refreshes. The search cache (sourcing_preview_candidates) is disposable.';

create unique index if not exists sourcing_project_candidates_apollo_key
  on public.sourcing_project_candidates (sourcing_project_id, apollo_id)
  where apollo_id is not null;

create unique index if not exists sourcing_project_candidates_candidate_key
  on public.sourcing_project_candidates (sourcing_project_id, candidate_id)
  where candidate_id is not null;

create index if not exists sourcing_project_candidates_tenant_idx
  on public.sourcing_project_candidates (tenant_id);

create index if not exists sourcing_project_candidates_candidate_idx
  on public.sourcing_project_candidates (candidate_id)
  where candidate_id is not null;

-- The workspace comes from the project; people change the status and notes,
-- the server records collects (who and when, and the candidate).
create or replace function public.sourcing_project_candidates_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_person uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    select o.tenant_id into v_tenant
    from public.sourcing_projects sp
    join public.organizations o on o.id = sp.organization_id
    where sp.id = new.sourcing_project_id;
    if v_tenant is null then
      raise exception 'Sourcing project % not found', new.sourcing_project_id
        using errcode = '23503';
    end if;
    new.tenant_id := v_tenant;
    new.created_at := now();
    if v_person is not null then
      -- People shortlist and archive; collecting is the server's job.
      new.candidate_id := null;
      new.collected_at := null;
      new.collected_by := null;
      if new.apollo_id is null then
        raise exception 'A project row needs an Apollo id' using errcode = '23514';
      end if;
    end if;
    if new.status <> 'active' then
      new.status_changed_at := coalesce(new.status_changed_at, now());
      new.status_changed_by := coalesce(new.status_changed_by, v_person);
    end if;
  else
    new.id := old.id;
    new.sourcing_project_id := old.sourcing_project_id;
    new.tenant_id := old.tenant_id;
    new.created_at := old.created_at;
    if v_person is not null then
      new.apollo_id := old.apollo_id;
      new.candidate_id := old.candidate_id;
      new.collected_at := old.collected_at;
      new.collected_by := old.collected_by;
    end if;
    if new.status is distinct from old.status then
      new.status_changed_at := now();
      new.status_changed_by := coalesce(v_person, new.status_changed_by);
    end if;
  end if;
  new.updated_at := now();
  return new;
end
$$;

create or replace trigger sourcing_project_candidates_guard
  before insert or update on public.sourcing_project_candidates
  for each row execute function public.sourcing_project_candidates_guard();

alter table public.sourcing_project_candidates enable row level security;

create policy "Workspace members read project candidates"
  on public.sourcing_project_candidates for select to authenticated
  using (public.user_has_tenant_access(tenant_id));

-- tenant_id is set by the trigger from the project, so the check runs on
-- the project's workspace, never on what the browser sent.
create policy "Recruiters add project candidates"
  on public.sourcing_project_candidates for insert to authenticated
  with check (
    public.user_has_tenant_access(tenant_id)
    and public.check_tenant_member_role(tenant_id, 'recruiter')
  );

create policy "Recruiters change project candidates"
  on public.sourcing_project_candidates for update to authenticated
  using (
    public.user_has_tenant_access(tenant_id)
    and public.check_tenant_member_role(tenant_id, 'recruiter')
  )
  with check (
    public.user_has_tenant_access(tenant_id)
    and public.check_tenant_member_role(tenant_id, 'recruiter')
  );

grant select, insert, update on public.sourcing_project_candidates to authenticated;
grant all on public.sourcing_project_candidates to service_role;

-- Carry over what projects already hold: everyone collected, and any
-- shortlist / not a fit / archive marks, one row per project and person.
insert into public.sourcing_project_candidates
  (sourcing_project_id, tenant_id, apollo_id, candidate_id, status,
   status_changed_at, collected_at, created_at)
select distinct on (p.sourcing_project_id, p.apollo_id)
  p.sourcing_project_id,
  o.tenant_id,
  p.apollo_id,
  c.id,
  case when p.status in ('shortlisted', 'not_a_fit', 'archived') then p.status else 'active' end,
  case when p.status in ('shortlisted', 'not_a_fit', 'archived')
    then coalesce(p.archived_at, p.created_at) end,
  p.collected_at,
  coalesce(p.created_at, now())
from public.sourcing_preview_candidates p
join public.sourcing_projects sp on sp.id = p.sourcing_project_id
join public.organizations o on o.id = sp.organization_id
left join public.candidates c
  on c.tenant_id = o.tenant_id
 and c.apollo_id = p.apollo_id
 and c.deleted_at is null
 and c.merged_into is null
where p.apollo_id is not null
  and (p.collected_at is not null or p.status in ('shortlisted', 'not_a_fit', 'archived'))
order by p.sourcing_project_id, p.apollo_id, p.collected_at desc nulls last, p.created_at desc
on conflict do nothing;

-- ── 4. Apollo credits as Apollo bills them ─────────────────────────────────

create table if not exists public.apollo_credit_plans (
  tenant_id uuid primary key references public.tenants(id),
  monthly_credits integer not null check (monthly_credits >= 0),
  cycle_day integer not null check (cycle_day between 1 and 28),
  reserve_credits integer not null default 0 check (reserve_credits >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.apollo_credit_plans is
  'The Apollo plan a workspace collects on: credits a month and the day the cycle renews (UTC). No plan means no collects.';

create table if not exists public.apollo_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  kind text not null check (kind in ('collect', 'phone', 'enrich', 'refresh', 'opening_balance', 'adjustment')),
  people integer not null default 0 check (people >= 0),
  credits integer not null,
  estimated boolean not null default false,
  user_id uuid,
  sourcing_project_id uuid,
  candidate_id uuid,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint apollo_credit_ledger_sign check (kind = 'adjustment' or credits >= 0)
);

comment on table public.apollo_credit_ledger is
  'One row per Apollo call that cost credits: what Apollo reported (credits_consumed), or an estimate (estimated = true) where Apollo reports nothing, such as a phone delivered by webhook (8). Written only by Edge Functions.';

create index if not exists apollo_credit_ledger_tenant_time_idx
  on public.apollo_credit_ledger (tenant_id, created_at);

alter table public.apollo_credit_plans enable row level security;
alter table public.apollo_credit_ledger enable row level security;

create policy "Workspace members read their Apollo plan"
  on public.apollo_credit_plans for select to authenticated
  using (public.user_has_tenant_access(tenant_id));

create policy "Workspace members read their Apollo ledger"
  on public.apollo_credit_ledger for select to authenticated
  using (public.user_has_tenant_access(tenant_id));

grant select on public.apollo_credit_plans, public.apollo_credit_ledger to authenticated;
grant all on public.apollo_credit_plans, public.apollo_credit_ledger to service_role;

create or replace function public.apollo_credit_status(p_tenant uuid)
returns table (
  configured boolean,
  monthly_credits integer,
  reserve_credits integer,
  cycle_start timestamptz,
  cycle_end timestamptz,
  used integer,
  remaining integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.apollo_credit_plans;
  v_today date := (now() at time zone 'UTC')::date;
  v_start date;
  v_from timestamptz;
  v_to timestamptz;
  v_used integer;
begin
  if auth.uid() is not null and not public.user_has_tenant_access(p_tenant) then
    raise exception 'No access to this workspace' using errcode = '42501';
  end if;

  select * into v_plan from public.apollo_credit_plans where tenant_id = p_tenant;
  if not found then
    return query select false, 0, 0, null::timestamptz, null::timestamptz, 0, 0;
    return;
  end if;

  v_start := date_trunc('month', v_today)::date + (v_plan.cycle_day - 1);
  if v_start > v_today then
    v_start := (date_trunc('month', v_today) - interval '1 month')::date + (v_plan.cycle_day - 1);
  end if;
  v_from := v_start::timestamp at time zone 'UTC';
  v_to := (v_start + interval '1 month')::timestamp at time zone 'UTC';

  select coalesce(sum(l.credits), 0)::integer into v_used
  from public.apollo_credit_ledger l
  where l.tenant_id = p_tenant and l.created_at >= v_from and l.created_at < v_to;

  return query select
    true,
    v_plan.monthly_credits,
    v_plan.reserve_credits,
    v_from,
    v_to,
    v_used,
    greatest(0, v_plan.monthly_credits - v_used);
end
$$;

comment on function public.apollo_credit_status(uuid) is
  'A workspace''s Apollo balance for the current cycle: plan, cycle dates, credits used (from the ledger) and remaining. Members and the server only.';

revoke all on function public.apollo_credit_status(uuid) from public, anon;
grant execute on function public.apollo_credit_status(uuid) to authenticated, service_role;

-- Virgilio's plan: 5,000 credits a month (Basic, 1 seat), renewing on the
-- 19th. Apollo's usage page on 2026-10-10 showed 1,813 used this cycle.
insert into public.apollo_credit_plans (tenant_id, monthly_credits, cycle_day, reserve_credits)
values ('5ba7b145-f251-4b18-8900-724cb06028ab', 5000, 19, 1000)
on conflict (tenant_id) do nothing;

insert into public.apollo_credit_ledger (tenant_id, kind, people, credits, estimated, note, created_at)
select '5ba7b145-f251-4b18-8900-724cb06028ab', 'opening_balance', 308, 1813, false,
  'Apollo usage page, 2026-10-10: 1,813 credits used since the cycle began on 2026-09-19',
  '2026-10-10 23:59:00+00'
where not exists (
  select 1 from public.apollo_credit_ledger
  where tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab' and kind = 'opening_balance'
);
