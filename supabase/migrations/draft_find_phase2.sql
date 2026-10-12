-- Find, Phase 2: the workflow (2026-10-12)
--
-- 1. Shortlist is a free step: a project row keeps a snapshot of the person
--    as the search showed them, so the shortlist outlives the search cache.
--    People in our own database can be shortlisted too (by candidate id).
-- 2. AI fit runs on the shortlist only; the server stores the score.
-- 3. job_entry_stage(): where a sourced person lands in a job. Application
--    Review when the job has it, else the first stage. (4 of 18 open jobs
--    list Final Candidate Review first, so "first stage" was wrong.)
-- 4. The talent pool: pool searches are ordinary Find projects with
--    pool_enabled; talent_pool_runs logs what each run spent and added;
--    notifications get a talent_pool category for the weekly summary.
-- 5. Nine pool searches for Virgilio (SDRs, AEs, revenue leaders × LATAM,
--    the US and EMEA) and the hourly pool-builder schedule.

-- ── 1 + 2. Project state: snapshot, pool flag, AI fit ──────────────────────
alter table public.sourcing_project_candidates
  add column if not exists snapshot jsonb not null default '{}'::jsonb,
  add column if not exists added_by_pool boolean not null default false,
  add column if not exists ai_fit_score smallint,
  add column if not exists ai_fit_summary text,
  add column if not exists ai_fit_strengths text[] not null default '{}',
  add column if not exists ai_fit_gaps text[] not null default '{}',
  add column if not exists ai_fit_at timestamptz,
  add column if not exists ai_fit_basis text;

alter table public.sourcing_project_candidates
  add constraint sourcing_project_candidates_snapshot_check
    check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) <= 16000),
  add constraint sourcing_project_candidates_ai_score_check
    check (ai_fit_score is null or ai_fit_score between 0 and 100),
  add constraint sourcing_project_candidates_ai_summary_check
    check (ai_fit_summary is null or char_length(ai_fit_summary) <= 600);

comment on column public.sourcing_project_candidates.snapshot is
  'The person as the search showed them when shortlisted (name, title, company, location, fit). Kept so the shortlist outlives the 24h search cache.';
comment on column public.sourcing_project_candidates.ai_fit_basis is
  'Fingerprint of the criteria and job the AI fit was scored against; a different fingerprint means the score is stale.';

create index if not exists sourcing_project_candidates_pool_idx
  on public.sourcing_project_candidates (tenant_id, collected_at)
  where added_by_pool;

-- People shortlist, mark not a fit and archive, by Apollo id or by our own
-- candidate id; the server records collects, pool rows and AI fit.
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
      new.collected_at := null;
      new.collected_by := null;
      new.added_by_pool := false;
      new.ai_fit_score := null;
      new.ai_fit_summary := null;
      new.ai_fit_strengths := '{}';
      new.ai_fit_gaps := '{}';
      new.ai_fit_at := null;
      new.ai_fit_basis := null;
      if new.candidate_id is not null and not exists (
        select 1 from public.candidates c
        where c.id = new.candidate_id and c.tenant_id = v_tenant
          and c.deleted_at is null and c.merged_into is null
      ) then
        raise exception 'Candidate % is not in this workspace', new.candidate_id
          using errcode = '23503';
      end if;
      if new.apollo_id is null and new.candidate_id is null then
        raise exception 'A project row needs an Apollo id or a candidate' using errcode = '23514';
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
      new.added_by_pool := old.added_by_pool;
      new.ai_fit_score := old.ai_fit_score;
      new.ai_fit_summary := old.ai_fit_summary;
      new.ai_fit_strengths := old.ai_fit_strengths;
      new.ai_fit_gaps := old.ai_fit_gaps;
      new.ai_fit_at := old.ai_fit_at;
      new.ai_fit_basis := old.ai_fit_basis;
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

-- ── 3. Where a sourced person lands in a job ───────────────────────────────
create or replace function public.job_entry_stage(p_job uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select h.id
  from public.job_hiring_stages h
  join public.job_stages s on s.id = h.stage_id
  where h.job_id = p_job
  order by (s.stage_type = 'application_review') desc, h.position asc
  limit 1
$$;

comment on function public.job_entry_stage(uuid) is
  'The stage a sourced or collected person enters a job at: Application Review when the job has one, otherwise its first stage.';

-- ── 4. The talent pool ─────────────────────────────────────────────────────
alter table public.sourcing_projects
  add column if not exists pool_enabled boolean not null default false;

comment on column public.sourcing_projects.pool_enabled is
  'This search fills the talent pool: the daily pool builder collects new people from it (no phone) with credits active searches do not need.';

create table if not exists public.talent_pool_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  ran_at timestamptz not null default now(),
  cycle_end timestamptz,
  credits_remaining integer not null default 0,
  reserve_applied integer not null default 0,
  budget_today integer not null default 0,
  spent_before integer not null default 0,
  searched integer not null default 0,
  new_people integer not null default 0,
  collected integer not null default 0,
  merged integer not null default 0,
  skipped_company_cap integer not null default 0,
  credits_used integer not null default 0,
  stopped_reason text check (stopped_reason is null or char_length(stopped_reason) <= 200),
  dry_run boolean not null default false,
  summary_sent boolean not null default false,
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 32000)
);

comment on table public.talent_pool_runs is
  'One row per pool-builder run: the budget it worked out, what it searched, collected and spent, and why it stopped.';

create index if not exists talent_pool_runs_tenant_idx
  on public.talent_pool_runs (tenant_id, ran_at desc);

alter table public.talent_pool_runs enable row level security;

create policy "Workspace members read pool runs"
  on public.talent_pool_runs for select to authenticated
  using (public.user_has_tenant_access(tenant_id));

alter type public.notification_category add value if not exists 'talent_pool';

-- ── 5. Virgilio's pool searches ────────────────────────────────────────────
do $$
declare
  v_tenant constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  v_org uuid;
  v_owner constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  r record;
begin
  select o.id into v_org from public.organizations o
  where o.id = v_tenant and o.tenant_id = v_tenant;
  if v_org is null or not exists (select 1 from auth.users u where u.id = v_owner) then
    return;
  end if;

  for r in
    select * from (values
      ('Talent pool · SDRs · LATAM',
        '["Sales Development Representative","SDR","Business Development Representative","BDR"]'::jsonb,
        '["MX","CO","AR","CL","BR","PE"]'::jsonb, '[]'::jsonb),
      ('Talent pool · SDRs · US',
        '["Sales Development Representative","SDR","Business Development Representative","BDR"]'::jsonb,
        '["US"]'::jsonb, '[]'::jsonb),
      ('Talent pool · SDRs · EMEA',
        '["Sales Development Representative","SDR","Business Development Representative","BDR"]'::jsonb,
        '["GB","DE","ES","NL","FR","IE","AE"]'::jsonb, '[]'::jsonb),
      ('Talent pool · AEs · LATAM',
        '["Account Executive","Senior Account Executive","Enterprise Account Executive","Mid-Market Account Executive"]'::jsonb,
        '["MX","CO","AR","CL","BR","PE"]'::jsonb, '[]'::jsonb),
      ('Talent pool · AEs · US',
        '["Account Executive","Senior Account Executive","Enterprise Account Executive","Mid-Market Account Executive"]'::jsonb,
        '["US"]'::jsonb, '[]'::jsonb),
      ('Talent pool · AEs · EMEA',
        '["Account Executive","Senior Account Executive","Enterprise Account Executive","Mid-Market Account Executive"]'::jsonb,
        '["GB","DE","ES","NL","FR","IE","AE"]'::jsonb, '[]'::jsonb),
      ('Talent pool · Revenue leaders · LATAM',
        '["VP of Sales","Head of Sales","Sales Director","Chief Revenue Officer","VP Revenue","Head of Revenue"]'::jsonb,
        '["MX","CO","AR","CL","BR","PE"]'::jsonb, '["director","vp","c_suite"]'::jsonb),
      ('Talent pool · Revenue leaders · US',
        '["VP of Sales","Head of Sales","Sales Director","Chief Revenue Officer","VP Revenue","Head of Revenue"]'::jsonb,
        '["US"]'::jsonb, '["director","vp","c_suite"]'::jsonb),
      ('Talent pool · Revenue leaders · EMEA',
        '["VP of Sales","Head of Sales","Sales Director","Chief Revenue Officer","VP Revenue","Head of Revenue"]'::jsonb,
        '["GB","DE","ES","NL","FR","IE","AE"]'::jsonb, '["director","vp","c_suite"]'::jsonb)
    ) as t(name, titles, locations, seniorities)
  loop
    if not exists (
      select 1 from public.sourcing_projects sp
      where sp.organization_id = v_org and sp.name = r.name
    ) then
      insert into public.sourcing_projects
        (organization_id, created_by, name, description, status, is_public, pool_enabled, search_criteria)
      values
        (v_org, v_owner, r.name,
         'Fills the talent pool with credits active searches don''t need. Edit the search to change who it collects.',
         'active', true, true,
         jsonb_build_object(
           'title_keywords', r.titles,
           'locations', r.locations,
           'seniorities', r.seniorities,
           'keywords', '[]'::jsonb
         ));
    end if;
  end loop;
end
$$;

-- Hourly between 13:00 and 22:00 UTC (7:00–16:00 in Guadalajara). Each run
-- spends at most its share of the day's budget; the secret lives in Vault.
select cron.schedule(
  'talent-pool-builder',
  '5 13-22 * * *',
  $cron$
  select net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/pool-builder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pool-secret', (select ds.decrypted_secret from vault.decrypted_secrets ds where ds.name = 'pool_builder_secret')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'at', now()),
    timeout_milliseconds := 150000
  );
  $cron$
);
