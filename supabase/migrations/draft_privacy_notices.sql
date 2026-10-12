-- Privacy (2026-10-12, approved by Allan): tell people we collect, let them
-- remove themselves, and ask before letting a profile go after 3 years.
--
--  * privacy_requests: one row per email we send (a notice to someone we
--    collected, or a 3-year "keep or remove?" check) and the answer.
--    The email carries a random token; only its SHA-256 is stored.
--  * privacy_suppressions: hashed email / LinkedIn / Apollo id of people who
--    asked to be removed, so sourcing never adds them again. Hashes only:
--    nothing readable is kept about someone who asked to be forgotten.
--  * candidates.privacy_notice_at, retention_checked_at, keep_until.
-- Removing a person's data happens in the privacy edge functions (service
-- role), never in a migration.

create table public.privacy_requests (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id),
  -- No foreign key: the request outlives a candidate who asked to be removed.
  candidate_id  uuid,
  purpose       text not null check (purpose in ('notice', 'retention')),
  email         text not null,
  token_hash    text not null unique,
  sent_at       timestamptz,
  answered_at   timestamptz,
  answer        text check (answer in ('keep', 'remove')),
  created_at    timestamptz not null default now()
);
create index privacy_requests_candidate on public.privacy_requests (candidate_id);
create index privacy_requests_open_retention on public.privacy_requests (sent_at)
  where purpose = 'retention' and answered_at is null;
alter table public.privacy_requests enable row level security;
-- No policies: only the service role (edge functions) reads or writes it.

create table public.privacy_suppressions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id),
  kind        text not null check (kind in ('email', 'linkedin', 'apollo')),
  value_hash  text not null,
  reason      text not null default 'removed',
  created_at  timestamptz not null default now(),
  unique (tenant_id, kind, value_hash)
);
alter table public.privacy_suppressions enable row level security;

alter table public.candidates
  add column privacy_notice_at timestamptz,
  add column retention_checked_at timestamptz,
  add column keep_until timestamptz;

-- The one way to hash an identifier for suppression.
create function public.privacy_hash(p_kind text, p_value text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_value is null or btrim(p_value) = '' then null
    else encode(extensions.digest(p_kind || ':' || lower(btrim(
      case when p_kind = 'linkedin'
        then regexp_replace(regexp_replace(p_value, '^.*linkedin\.com/in/', ''), '[/?#].*$', '')
        else p_value end)), 'sha256'), 'hex')
  end
$$;

-- Records a removed person's identifiers (called by the edge function before
-- it removes the candidate).
create function public.privacy_suppress_candidate(p_candidate_id uuid, p_reason text default 'removed')
returns integer language plpgsql security definer set search_path = '' as $$
declare
  c public.candidates%rowtype;
  n integer := 0;
  v text;
begin
  select * into c from public.candidates where id = p_candidate_id;
  if c.id is null then return 0; end if;
  for v in
    select x from unnest(array[c.email, c.contact_email]) x where x is not null and btrim(x) <> ''
    union
    select jsonb_array_elements_text(coalesce(to_jsonb(c.contact_emails), '[]'::jsonb))
  loop
    insert into public.privacy_suppressions (tenant_id, kind, value_hash, reason)
    values (c.tenant_id, 'email', public.privacy_hash('email', v), p_reason)
    on conflict do nothing;
    n := n + 1;
  end loop;
  if coalesce(c.linkedin_slug, c.linkedin_url) is not null then
    insert into public.privacy_suppressions (tenant_id, kind, value_hash, reason)
    values (c.tenant_id, 'linkedin', public.privacy_hash('linkedin', coalesce(c.linkedin_slug, c.linkedin_url)), p_reason)
    on conflict do nothing;
    n := n + 1;
  end if;
  if c.apollo_id is not null then
    insert into public.privacy_suppressions (tenant_id, kind, value_hash, reason)
    values (c.tenant_id, 'apollo', public.privacy_hash('apollo', c.apollo_id), p_reason)
    on conflict do nothing;
    n := n + 1;
  end if;
  return n;
end $$;
revoke execute on function public.privacy_suppress_candidate(uuid, text) from public, anon, authenticated;

-- Sourcing never adds back someone who asked to be removed. Applies to people
-- we collect (not to someone who applies to a job themselves).
create function public.candidates_skip_suppressed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.source, '') not in ('apollo', 'pdl', 'people_data_labs', 'coresignal', 'LinkedIn', 'linkedin_extension', 'Sourcing') then
    return new;
  end if;
  if exists (
    select 1 from public.privacy_suppressions s
    where s.tenant_id = new.tenant_id
      and (
        (s.kind = 'email' and s.value_hash in (public.privacy_hash('email', new.email), public.privacy_hash('email', new.contact_email)))
        or (s.kind = 'linkedin' and s.value_hash = public.privacy_hash('linkedin', coalesce(new.linkedin_slug, new.linkedin_url)))
        or (s.kind = 'apollo' and s.value_hash = public.privacy_hash('apollo', new.apollo_id))
      )
  ) then
    return null; -- skipped: this person asked to be removed
  end if;
  return new;
end $$;

create trigger a0_candidates_skip_suppressed before insert on public.candidates
  for each row execute function public.candidates_skip_suppressed();

-- Who gets the "we added your details" notice: people we collected (not
-- applicants), with an email, not yet told, newest first so anyone within
-- the 30-day window goes before the backlog.
create function public.candidates_due_for_notice(p_tenant uuid, p_limit integer)
returns table (candidate_id uuid, email text, first_name text, source text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id,
         lower(btrim(coalesce(nullif(c.email, ''), c.contact_email))),
         nullif(split_part(btrim(coalesce(c.candidate_name, '')), ' ', 1), ''),
         c.source,
         c.created_at
  from public.candidates c
  where c.tenant_id = p_tenant
    and c.deleted_at is null
    and c.privacy_notice_at is null
    and c.source in ('apollo', 'pdl', 'people_data_labs', 'coresignal', 'LinkedIn', 'linkedin_extension', 'Sourcing')
    and coalesce(nullif(c.email, ''), c.contact_email) is not null
    and coalesce(nullif(c.email, ''), c.contact_email) like '%@%'
  order by c.created_at desc
  limit greatest(0, least(p_limit, 1000));
$$;
revoke execute on function public.candidates_due_for_notice(uuid, integer) from public, anon, authenticated;

-- Who gets the 3-year "keep or remove?" check: no contact with us for 3
-- years (their profile, emails, chat or pipelines), not asked yet, not
-- already told to keep.
create function public.candidates_due_for_retention(p_tenant uuid, p_limit integer)
returns table (candidate_id uuid, email text, first_name text, last_contact timestamptz)
language sql stable security definer set search_path = '' as $$
  with last as (
    select c.id, c.candidate_name, coalesce(nullif(c.email, ''), c.contact_email) as email,
           greatest(
             c.created_at,
             (select max(coalesce(e.sent_at, e.received_at, e.created_at)) from public.email_logs e where e.candidate_id = c.id),
             (select max(a.updated_at) from public.job_candidate_associations a where a.candidate_id = c.id),
             (select max(t.updated_at) from public.chat_threads t where t.candidate_id = c.id)
           ) as last_contact
    from public.candidates c
    where c.tenant_id = p_tenant
      and c.deleted_at is null
      and c.retention_checked_at is null
      and (c.keep_until is null or c.keep_until < now())
      and c.created_at < now() - interval '3 years'
  )
  select id, lower(btrim(email)), nullif(split_part(btrim(coalesce(candidate_name, '')), ' ', 1), ''), last_contact
  from last
  where last_contact < now() - interval '3 years'
    and email is not null and email like '%@%'
  order by last_contact
  limit greatest(0, least(p_limit, 1000));
$$;
revoke execute on function public.candidates_due_for_retention(uuid, integer) from public, anon, authenticated;

-- Daily run: notices (capped per day by the function) and the 3-year check.
select cron.schedule(
  'privacy-notices',
  '15 16 * * *',
  $cmd$
  select net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/privacy-notices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $cmd$
);
