-- Find Phase 3 (2026-10-12): keeping candidates current.
--
-- 1. Every profile field remembers where its value came from and when
--    (candidates.field_provenance), kept by a trigger on every write.
-- 2. apply_candidate_update() is the one path for outside data (Apollo,
--    résumés, applications, the Chrome extension). It fills gaps, refreshes
--    only what a source set, and never touches what a person typed.
-- 3. When a source shows a new company or title, the old role goes into the
--    work history, the candidate's timeline gets an activity, and the people
--    who have them in a pipeline or on a shortlist get a notification.
-- 4. Apollo search previews refresh title and company for free for people
--    we already have.
-- 5. A daily job refreshes pipeline and shortlist people older than 90 days,
--    under a monthly credit cap (default 1,000).

-- ── 1. Columns ─────────────────────────────────────────────────────────────
alter table public.candidates
  add column if not exists field_provenance jsonb not null default '{}'::jsonb,
  add column if not exists profile_refreshed_at timestamptz;

alter table public.candidates
  add constraint candidates_field_provenance_object
  check (jsonb_typeof(field_provenance) = 'object');

comment on column public.candidates.field_provenance is
  'Per field: {"src": person|apollo|apollo_preview|resume|application|extension|pdl|import|coresignal|merge|system|unknown, "at": when the value was set, "by": user, "checked": when a source last confirmed it}. Written by the zz_candidates_provenance trigger; only apply_candidate_update() may write it directly.';
comment on column public.candidates.profile_refreshed_at is
  'Last full Apollo refresh (button or scheduled), matched or not.';

alter table public.apollo_credit_plans
  add column if not exists refresh_cap_credits integer not null default 1000;

alter table public.apollo_credit_plans
  add constraint apollo_credit_plans_refresh_cap_check check (refresh_cap_credits >= 0);

-- ── 2. Helpers ─────────────────────────────────────────────────────────────
create or replace function public.candidate_tracked_fields()
returns text[]
language sql immutable parallel safe set search_path = '' as $$
  select array[
    'candidate_name', 'email', 'phone', 'linkedin_url',
    'current_job_title', 'role_current', 'company_current',
    'location_city', 'location_state', 'location_country',
    'salary_amount', 'salary_currency', 'salary_period', 'bio'
  ]::text[]
$$;

-- The provenance a new record gets from its source column.
create or replace function public.provenance_source_for(p_source text)
returns text
language sql immutable parallel safe set search_path = '' as $$
  select case lower(btrim(coalesce(p_source, '')))
    when 'apollo' then 'apollo'
    when 'linkedin_extension' then 'extension'
    when 'public_posting' then 'application'
    when 'direct application' then 'application'
    when 'virgilio career page' then 'application'
    when 'talent' then 'application'
    when 'talent.com' then 'application'
    when 'occ mundial' then 'application'
    when 'occ.com.mx' then 'application'
    when 'gohire' then 'application'
    when 'job_import' then 'import'
    when 'import' then 'import'
    when 'csv_import' then 'import'
    when 'pdl' then 'pdl'
    when 'coresignal' then 'coresignal'
    else null
  end
$$;

-- A company name reduced to what identifies it: "Acme, Inc." = "ACME".
create or replace function public.company_key(p text)
returns text
language sql immutable parallel safe set search_path = '' as $$
  select nullif(replace(btrim(regexp_replace(
    regexp_replace(
      translate(lower(coalesce(p, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'),
      '[^a-z0-9]+', ' ', 'g'),
    '\m(inc|llc|ltd|limited|corp|corporation|co|company|sa|sas|sapi|de|cv|rl|srl|s|a|gmbh|ag|plc|bv|the|group|grupo|holding|holdings)\M',
    ' ', 'g')), ' ', ''), '')
$$;

create or replace function public.same_company(a text, b text)
returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select case
    when public.company_key(a) is null or public.company_key(b) is null then false
    when public.company_key(a) = public.company_key(b) then true
    when least(length(public.company_key(a)), length(public.company_key(b))) >= 4
      and (position(public.company_key(a) in public.company_key(b)) > 0
        or position(public.company_key(b) in public.company_key(a)) > 0) then true
    else false
  end
$$;

-- How two values of one field are compared.
create or replace function public.field_value_key(p_field text, p_value text)
returns text
language sql immutable parallel safe set search_path = '' as $$
  select case
    when p_value is null or btrim(p_value) = '' then null
    when p_field = 'linkedin_url' then coalesce(public.linkedin_slug(p_value), lower(btrim(p_value)))
    when p_field = 'email' then lower(btrim(p_value))
    when p_field = 'phone' then coalesce(public.identity_phone(p_value), btrim(p_value))
    when p_field = 'company_current' then coalesce(public.company_key(p_value), lower(btrim(p_value)))
    when p_field = 'salary_amount' and btrim(p_value) ~ '^[0-9]+(\.[0-9]+)?$' then (round(btrim(p_value)::numeric, 2))::text
    else regexp_replace(lower(btrim(p_value)), '\s+', ' ', 'g')
  end
$$;

-- ── 3. Backfill what we can tell about existing values ────────────────────
-- Apollo and the extension wrote role_current only; the profile reads
-- current_job_title. Mirror it once (257 people on 2026-10-12).
alter table public.candidates disable trigger update_candidates_updated_at;
alter table public.candidates disable trigger trg_log_candidate_updated;
alter table public.candidates disable trigger candidates_identities_sync;
alter table public.candidates disable trigger trg_normalize_candidate_location;
alter table public.candidates disable trigger trg_validate_candidate_name;

update public.candidates c
   set current_job_title = c.role_current
 where c.current_job_title is null
   and nullif(btrim(c.role_current), '') is not null;

-- Values from before tracking: the record's source when it says one, the
-- résumé for title, company and location when the résumé was read (it
-- overwrote them), otherwise unknown. Unknown is treated like a person's
-- edit: kept until someone changes it.
update public.candidates c
   set field_provenance = coalesce((
     select jsonb_object_agg(x.f, jsonb_build_object(
              'src', x.src,
              'at', to_char(x.at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))
     from (
       select f,
              case
                when public.provenance_source_for(c.source) = 'apollo' then 'apollo'
                when c.enriched_at is not null
                  and f in ('current_job_title', 'role_current', 'company_current',
                            'location_city', 'location_state', 'location_country') then 'resume'
                else coalesce(public.provenance_source_for(c.source), 'unknown')
              end as src,
              case
                when public.provenance_source_for(c.source) = 'apollo' then coalesce(c.apollo_collected_at, c.created_at)
                when c.enriched_at is not null
                  and f in ('current_job_title', 'role_current', 'company_current',
                            'location_city', 'location_state', 'location_country') then c.enriched_at
                else c.created_at
              end as at
       from unnest(public.candidate_tracked_fields()) as f
       where nullif(btrim(to_jsonb(c) ->> f), '') is not null
         and not (f in ('salary_currency', 'salary_period') and c.salary_amount is null)
     ) x
   ), '{}'::jsonb)
 where c.field_provenance = '{}'::jsonb;

alter table public.candidates enable trigger update_candidates_updated_at;
alter table public.candidates enable trigger trg_log_candidate_updated;
alter table public.candidates enable trigger candidates_identities_sync;
alter table public.candidates enable trigger trg_normalize_candidate_location;
alter table public.candidates enable trigger trg_validate_candidate_name;

-- ── 4. The provenance trigger ─────────────────────────────────────────────
-- Runs last of the BEFORE triggers (zz_), so it sees the final values.
-- A write tagged by apply_candidate_update() (gio.write_source) records
-- that source; any other signed-in write is a person's edit; any other
-- server write is "system". Nobody but apply_candidate_update() can write
-- field_provenance itself.
create or replace function public.candidates_track_provenance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_src text := nullif(current_setting('gio.write_source', true), '');
  v_actor text := nullif(current_setting('gio.write_actor', true), '');
  v_uid uuid := auth.uid();
  v_at text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_prov jsonb;
  v_entry jsonb;
  f text;
begin
  if v_actor is null and v_uid is not null then
    v_actor := v_uid::text;
  end if;

  if tg_op = 'INSERT' then
    v_src := coalesce(v_src, public.provenance_source_for(new.source),
                      case when v_uid is not null then 'person' else 'system' end);
    v_prov := '{}'::jsonb;
    foreach f in array public.candidate_tracked_fields() loop
      continue when f in ('salary_currency', 'salary_period') and new.salary_amount is null;
      if nullif(btrim(v_new ->> f), '') is not null then
        v_entry := jsonb_build_object('src', v_src, 'at', v_at);
        if v_actor is not null then v_entry := v_entry || jsonb_build_object('by', v_actor); end if;
        v_prov := v_prov || jsonb_build_object(f, v_entry);
      end if;
    end loop;
    new.field_provenance := v_prov;
    return new;
  end if;

  v_old := to_jsonb(old);
  if v_src is null then
    new.field_provenance := old.field_provenance;
    v_src := case when v_uid is not null then 'person' else 'system' end;
  end if;
  v_prov := coalesce(new.field_provenance, '{}'::jsonb);

  foreach f in array public.candidate_tracked_fields() loop
    continue when f in ('salary_currency', 'salary_period') and new.salary_amount is null;
    if (v_new -> f) is distinct from (v_old -> f) then
      if nullif(btrim(v_new ->> f), '') is null then
        v_prov := v_prov - f;
      else
        v_entry := jsonb_build_object('src', v_src, 'at', v_at);
        if v_actor is not null then v_entry := v_entry || jsonb_build_object('by', v_actor); end if;
        v_prov := v_prov || jsonb_build_object(f, v_entry);
      end if;
    end if;
  end loop;

  new.field_provenance := v_prov;
  return new;
end
$$;

create trigger zz_candidates_provenance
  before insert or update on public.candidates
  for each row execute function public.candidates_track_provenance();

-- Merges keep the values someone chose in the merge dialog; they record
-- "merge" as the source. merge-candidates calls this instead of
-- merge_candidate_payload() directly.
create or replace function public.merge_candidate_payload_tracked(
  p_surviving uuid,
  p_incoming jsonb,
  p_resolutions jsonb default '{}'::jsonb,
  p_actor uuid default null,
  p_merged uuid default null,
  p_resume jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform set_config('gio.write_source', 'merge', true);
  perform set_config('gio.write_actor', coalesce(p_actor::text, ''), true);
  v_result := public.merge_candidate_payload(p_surviving, p_incoming, p_resolutions, p_actor, p_merged, p_resume);
  perform set_config('gio.write_source', '', true);
  perform set_config('gio.write_actor', '', true);
  return v_result;
end
$$;

revoke all on function public.merge_candidate_payload_tracked(uuid, jsonb, jsonb, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.merge_candidate_payload_tracked(uuid, jsonb, jsonb, uuid, uuid, jsonb) to service_role;

-- Writes through apply_candidate_update() aren't "Candidate updated" by
-- whoever happened to be signed in; a job change logs its own activity.
create or replace function public.log_candidate_updated()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_tenant_id uuid;
begin
  -- Guard: skip when no authenticated user
  v_user_id := auth.uid();
  if v_user_id is null then
    return new;
  end if;
  if coalesce(current_setting('gio.write_source', true), '') <> '' then
    return new;
  end if;

  v_org_id   := new.organization_id;
  v_tenant_id := new.tenant_id;

  perform log_activity(
    p_user_id        => v_user_id,
    p_organization_id => v_org_id,
    p_tenant_id      => v_tenant_id,
    p_activity_type  => 'candidate_updated'::activity_type,
    p_title          => 'Candidate updated',
    p_description    => new.candidate_name || '''s profile was updated',
    p_metadata       => jsonb_build_object(
                          'candidate_id', new.id,
                          'candidate_name', new.candidate_name
                        ),
    p_entity_type    => 'candidate',
    p_entity_id      => new.id
  );

  return new;
end;
$function$;

-- ── 5. Job changes ─────────────────────────────────────────────────────────
create or replace function public.record_candidate_job_change(
  p_candidate_id uuid,
  p_kind text,
  p_old_title text,
  p_old_company text,
  p_new_title text,
  p_new_company text,
  p_source text,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.candidates;
  v_row public.candidate_work_experience;
  v_key text := coalesce(public.company_key(p_new_company), '') || '|' || coalesce(lower(btrim(p_new_title)), '');
  v_title text;
  v_subtitle text;
  v_source_label text;
begin
  select * into c from public.candidates where id = p_candidate_id;
  if not found then return; end if;

  -- The same change seen again within 30 days (another search, a refresh)
  -- isn't news.
  if exists (
    select 1 from public.activities a
    where a.entity_type = 'candidate' and a.entity_id = p_candidate_id
      and a.activity_type = 'candidate_job_changed'
      and a.metadata ->> 'change_key' = v_key
      and a.created_at > now() - interval '30 days'
  ) then
    return;
  end if;

  -- Work history: the old role ends today, the new one is current.
  select * into v_row
  from public.candidate_work_experience w
  where w.candidate_id = p_candidate_id
    and coalesce(w.is_current, false)
    and public.same_company(w.company_name, p_old_company)
  order by w.start_date desc nulls last
  limit 1;

  if p_kind = 'job' then
    if v_row.id is not null then
      update public.candidate_work_experience
         set is_current = false, end_date = coalesce(end_date, current_date)
       where id = v_row.id;
    else
      insert into public.candidate_work_experience (candidate_id, company_name, job_title, is_current, end_date)
      values (p_candidate_id, p_old_company, coalesce(nullif(btrim(p_old_title), ''), 'Unknown title'), false, current_date);
    end if;
    if not exists (
      select 1 from public.candidate_work_experience w
      where w.candidate_id = p_candidate_id and coalesce(w.is_current, false)
        and public.same_company(w.company_name, p_new_company)
    ) then
      insert into public.candidate_work_experience (candidate_id, company_name, job_title, is_current)
      values (p_candidate_id, p_new_company, coalesce(nullif(btrim(p_new_title), ''), nullif(btrim(p_old_title), ''), 'Unknown title'), true);
    end if;
  else
    -- A new title at the same company.
    insert into public.candidate_work_experience (candidate_id, company_name, job_title, start_date, is_current, end_date)
    values (p_candidate_id, coalesce(v_row.company_name, p_old_company, c.company_current, 'Unknown company'),
            coalesce(nullif(btrim(p_old_title), ''), 'Unknown title'), v_row.start_date, false, current_date);
    if v_row.id is not null then
      update public.candidate_work_experience
         set job_title = p_new_title, start_date = null, duration_months = null, standardized_title = null
       where id = v_row.id;
    else
      insert into public.candidate_work_experience (candidate_id, company_name, job_title, is_current)
      values (p_candidate_id, coalesce(c.company_current, p_old_company, 'Unknown company'), p_new_title, true);
    end if;
  end if;

  v_source_label := case p_source
    when 'apollo' then 'Apollo'
    when 'apollo_preview' then 'an Apollo search'
    when 'resume' then 'their résumé'
    when 'application' then 'their application'
    when 'extension' then 'their LinkedIn profile'
    else 'new data'
  end;

  if p_kind = 'job' then
    v_title := coalesce(c.candidate_name, 'A candidate') || ' moved to ' || p_new_company;
    v_subtitle := 'Was ' || coalesce(nullif(btrim(p_old_title), '') || ' at ', '') || p_old_company;
  else
    v_title := coalesce(c.candidate_name, 'A candidate') || ' is now ' || p_new_title;
    v_subtitle := 'Was ' || coalesce(nullif(btrim(p_old_title), ''), 'another role')
                  || coalesce(' at ' || coalesce(c.company_current, p_old_company), '');
  end if;

  insert into public.activities (user_id, organization_id, tenant_id, activity_type, title, description,
                                 metadata, entity_type, entity_id)
  values (
    coalesce(p_actor, c.created_by, c.id), c.organization_id, c.tenant_id,
    'candidate_job_changed'::public.activity_type,
    case when p_kind = 'job' then 'Moved to ' || p_new_company else 'New role: ' || p_new_title end,
    v_subtitle || '. Seen in ' || v_source_label || '.',
    jsonb_build_object(
      'candidate_id', c.id, 'candidate_name', c.candidate_name, 'kind', p_kind,
      'old_title', p_old_title, 'old_company', p_old_company,
      'new_title', p_new_title, 'new_company', p_new_company,
      'source', p_source, 'change_key', v_key),
    'candidate', c.id
  );

  -- Who cares: the team on open jobs where they're active, and the people
  -- on searches where they're shortlisted. Not whoever pressed Refresh.
  insert into public.notifications (user_id, tenant_id, category, title, subtitle, preview,
                                    entity_kind, entity_id, candidate_id, job_id, action_url, metadata)
  select r.user_id, c.tenant_id, 'candidate_update'::public.notification_category,
         v_title, v_subtitle, r.why,
         'candidate', c.id, c.id, r.job_id, '/candidates/' || c.id::text,
         jsonb_build_object('kind', p_kind, 'old_title', p_old_title, 'old_company', p_old_company,
                            'new_title', p_new_title, 'new_company', p_new_company, 'source', p_source)
  from (
    select distinct on (u.user_id) u.user_id, u.why, u.job_id
    from (
      select ja.user_id, 'In your pipeline for ' || j.title as why, j.id as job_id, 1 as rank
      from public.job_candidate_associations jca
      join public.jobs j on j.id = jca.job_id and j.status = 'open'
      join public.job_assignments ja on ja.job_id = j.id and ja.deleted_at is null
      where jca.candidate_id = c.id and jca.status in ('active', 'offer')
      union all
      select j.created_by, 'In your pipeline for ' || j.title, j.id, 2
      from public.job_candidate_associations jca
      join public.jobs j on j.id = jca.job_id and j.status = 'open'
      where jca.candidate_id = c.id and jca.status in ('active', 'offer') and j.created_by is not null
      union all
      select spc2.user_id, 'Shortlisted in ' || sp.name, null::uuid, 3
      from public.sourcing_project_candidates s
      join public.sourcing_projects sp on sp.id = s.sourcing_project_id
      join public.sourcing_project_collaborators spc2 on spc2.sourcing_project_id = sp.id
      where s.candidate_id = c.id and s.status = 'shortlisted'
      union all
      select sp.created_by, 'Shortlisted in ' || sp.name, null::uuid, 4
      from public.sourcing_project_candidates s
      join public.sourcing_projects sp on sp.id = s.sourcing_project_id
      where s.candidate_id = c.id and s.status = 'shortlisted' and sp.created_by is not null
    ) u
    where u.user_id is not null and u.user_id is distinct from p_actor
    order by u.user_id, u.rank
  ) r;
end
$$;

revoke all on function public.record_candidate_job_change(uuid, text, text, text, text, text, text, uuid) from public, anon, authenticated;

-- ── 6. The one path for outside data ──────────────────────────────────────
-- Rules, per field:
--   * an empty incoming value never clears anything;
--   * name, email, phone and LinkedIn are filled, never replaced; other
--     emails and phones join contact_emails / contact_phones;
--   * a person's edit (or a value from before tracking) is never replaced;
--   * a résumé, application or extension value under 30 days old isn't
--     replaced by Apollo;
--   * otherwise, in "refresh" mode, the newer value wins; in "fill" mode
--     only gaps are filled;
--   * an unchanged value is marked as checked.
-- Returns {"applied": [...], "kept": {field: incoming}, "job_change": {...}}.
create or replace function public.apply_candidate_update_internal(
  p_candidate_id uuid,
  p_source text,
  p_fields jsonb,
  p_mode text,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.candidates;
  v_fields jsonb := coalesce(p_fields, '{}'::jsonb);
  v_cur jsonb;
  v_prov jsonb;
  v_set jsonb := '{}'::jsonb;
  v_kept jsonb := '{}'::jsonb;
  v_checked text[] := '{}';
  v_fill_only constant text[] := array['candidate_name', 'email', 'phone', 'linkedin_url'];
  v_firsthand constant text[] := array['resume', 'application', 'extension'];
  v_now text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  f text;
  v_in text;
  v_old text;
  v_src text;
  v_at timestamptz;
  v_emails text[];
  v_phones text[];
  v_elem jsonb;
  v_key text;
  v_contacts_changed boolean := false;
  v_apollo_id text;
  v_old_title text;
  v_new_title text;
  v_old_company text;
  v_new_company text;
  v_job jsonb;
begin
  if p_source not in ('apollo', 'apollo_preview', 'resume', 'application', 'extension', 'pdl', 'import') then
    raise exception 'Unknown source %', p_source using errcode = '22023';
  end if;
  if p_mode not in ('fill', 'refresh') then
    raise exception 'Unknown mode %', p_mode using errcode = '22023';
  end if;

  select * into c from public.candidates where id = p_candidate_id for update;
  if not found or c.deleted_at is not null or c.merged_into is not null then
    return jsonb_build_object('applied', '[]'::jsonb, 'kept', '{}'::jsonb, 'job_change', null, 'missing', true);
  end if;

  -- One title, two columns: whichever the source sent fills both.
  if v_fields ? 'role_current' and not v_fields ? 'current_job_title' then
    v_fields := v_fields || jsonb_build_object('current_job_title', v_fields -> 'role_current');
  elsif v_fields ? 'current_job_title' and not v_fields ? 'role_current' then
    v_fields := v_fields || jsonb_build_object('role_current', v_fields -> 'current_job_title');
  end if;

  v_cur := to_jsonb(c);
  v_prov := coalesce(c.field_provenance, '{}'::jsonb);

  foreach f in array public.candidate_tracked_fields() loop
    continue when not v_fields ? f;
    v_in := nullif(btrim(v_fields ->> f), '');
    continue when v_in is null;
    continue when f = 'salary_amount' and v_in !~ '^[0-9]+(\.[0-9]+)?$';
    v_old := nullif(btrim(v_cur ->> f), '');

    if v_old is null then
      v_set := v_set || jsonb_build_object(f, v_in);
      continue;
    end if;

    if public.field_value_key(f, v_old) is not distinct from public.field_value_key(f, v_in) then
      v_checked := v_checked || f;
      continue;
    end if;

    if f = any(v_fill_only) then
      continue;
    end if;

    v_src := coalesce(v_prov -> f ->> 'src', 'unknown');
    v_at := nullif(v_prov -> f ->> 'at', '')::timestamptz;

    if p_mode = 'fill'
       or v_src in ('person', 'unknown', 'merge')
       or (v_src = any(v_firsthand) and not p_source = any(v_firsthand)
           and v_at is not null and v_at > now() - interval '30 days') then
      v_kept := v_kept || jsonb_build_object(f, v_in);
      continue;
    end if;

    v_set := v_set || jsonb_build_object(f, v_in);
  end loop;

  -- The two title columns move together, following current_job_title
  -- (the one people edit and the profile shows).
  if v_kept ? 'current_job_title' and v_set ? 'role_current' then
    v_kept := v_kept || jsonb_build_object('role_current', v_set -> 'role_current');
    v_set := v_set - 'role_current';
  elsif v_set ? 'current_job_title' then
    v_set := v_set || jsonb_build_object('role_current', v_set -> 'current_job_title');
    v_kept := v_kept - 'role_current';
  end if;

  -- Other emails and phones: added to the contact lists, never removed.
  v_emails := coalesce(c.contact_emails, array[]::text[]);
  for v_elem in
    select e from jsonb_array_elements(case when jsonb_typeof(v_fields -> 'contact_emails') = 'array'
                                            then v_fields -> 'contact_emails' else '[]'::jsonb end) e
    union all
    select jsonb_build_object('type', 'work', 'email', v_fields ->> 'email', 'status', v_fields ->> 'email_status')
    where public.identity_email(v_fields ->> 'email') is not null
  loop
    v_key := public.identity_email(case when jsonb_typeof(v_elem) = 'string' then v_elem #>> '{}' else v_elem ->> 'email' end);
    continue when v_key is null;
    if not exists (
      select 1 from unnest(v_emails) x where public.identity_email(public.contact_value(x, 'email')) = v_key
    ) then
      v_emails := v_emails || (case when jsonb_typeof(v_elem) = 'string'
                                    then jsonb_build_object('type', 'other', 'email', v_key)
                                    else jsonb_strip_nulls(v_elem) end)::text;
      v_contacts_changed := true;
    end if;
  end loop;

  v_phones := coalesce(c.contact_phones, array[]::text[]);
  for v_elem in
    select e from jsonb_array_elements(case when jsonb_typeof(v_fields -> 'contact_phones') = 'array'
                                            then v_fields -> 'contact_phones' else '[]'::jsonb end) e
    union all
    select jsonb_build_object('type', 'other', 'number', v_fields ->> 'phone')
    where public.identity_phone(v_fields ->> 'phone') is not null
  loop
    v_key := public.identity_phone(case when jsonb_typeof(v_elem) = 'string' then v_elem #>> '{}' else v_elem ->> 'number' end);
    continue when v_key is null;
    if not exists (
      select 1 from unnest(v_phones) x where public.identity_phone(public.contact_value(x, 'number')) = v_key
    ) then
      v_phones := v_phones || (case when jsonb_typeof(v_elem) = 'string'
                                    then jsonb_build_object('type', 'other', 'number', v_elem #>> '{}')
                                    else jsonb_strip_nulls(v_elem) end)::text;
      v_contacts_changed := true;
    end if;
  end loop;

  -- The Apollo id joins only when nobody else in the workspace holds it.
  v_apollo_id := nullif(btrim(v_fields ->> 'apollo_id'), '');
  if v_apollo_id is not null and (c.apollo_id is not null or exists (
       select 1 from public.candidates o
       where o.tenant_id = c.tenant_id and o.apollo_id = v_apollo_id and o.id <> c.id)) then
    v_apollo_id := null;
  end if;

  -- A new company, or a new title at the same company, is a job change.
  v_old_title := coalesce(nullif(btrim(c.current_job_title), ''), nullif(btrim(c.role_current), ''));
  v_new_title := v_set ->> 'current_job_title';
  v_old_company := nullif(btrim(c.company_current), '');
  v_new_company := v_set ->> 'company_current';
  if v_old_company is not null and v_new_company is not null
     and not public.same_company(v_old_company, v_new_company) then
    v_job := jsonb_build_object('kind', 'job', 'old_title', v_old_title, 'old_company', v_old_company,
                                'new_title', coalesce(v_new_title, v_fields ->> 'current_job_title'),
                                'new_company', v_new_company);
  elsif v_old_title is not null and v_new_title is not null
        and not (v_set ? 'company_current')
        and (not v_fields ? 'company_current' or public.same_company(v_old_company, v_fields ->> 'company_current'))
        and public.field_value_key('current_job_title', v_old_title) <> public.field_value_key('current_job_title', v_new_title) then
    v_job := jsonb_build_object('kind', 'role', 'old_title', v_old_title, 'old_company', v_old_company,
                                'new_title', v_new_title, 'new_company', v_old_company);
  end if;

  -- Search previews arrive by the hundred; only real changes are written.
  if p_source = 'apollo_preview' then
    v_checked := '{}';
  end if;

  if v_set = '{}'::jsonb and cardinality(v_checked) = 0 and not v_contacts_changed and v_apollo_id is null
     and not (v_fields ? 'apollo_collected_at')
     and not (p_source = 'apollo' and p_mode = 'refresh' and v_fields ? 'refreshed') then
    return jsonb_build_object('applied', '[]'::jsonb, 'kept', v_kept, 'job_change', null);
  end if;

  -- Checked values keep their source and age; they gain "checked".
  foreach f in array v_checked loop
    if v_prov ? f then
      v_prov := jsonb_set(v_prov, array[f, 'checked'], to_jsonb(v_now));
    end if;
  end loop;

  perform set_config('gio.write_source', p_source, true);
  perform set_config('gio.write_actor', coalesce(p_actor::text, ''), true);

  update public.candidates t set
    candidate_name     = case when v_set ? 'candidate_name' then v_set ->> 'candidate_name' else t.candidate_name end,
    email              = case when v_set ? 'email' then v_set ->> 'email' else t.email end,
    phone              = case when v_set ? 'phone' then v_set ->> 'phone' else t.phone end,
    linkedin_url       = case when v_set ? 'linkedin_url' then v_set ->> 'linkedin_url' else t.linkedin_url end,
    current_job_title  = case when v_set ? 'current_job_title' then v_set ->> 'current_job_title' else t.current_job_title end,
    role_current       = case when v_set ? 'role_current' then v_set ->> 'role_current' else t.role_current end,
    company_current    = case when v_set ? 'company_current' then v_set ->> 'company_current' else t.company_current end,
    location_city      = case when v_set ? 'location_city' then v_set ->> 'location_city' else t.location_city end,
    location_state     = case when v_set ? 'location_state' then v_set ->> 'location_state' else t.location_state end,
    location_country   = case when v_set ? 'location_country' then v_set ->> 'location_country' else t.location_country end,
    salary_amount      = case when v_set ? 'salary_amount' then (v_set ->> 'salary_amount')::numeric else t.salary_amount end,
    salary_currency    = case when v_set ? 'salary_currency' then v_set ->> 'salary_currency' else t.salary_currency end,
    salary_period      = case when v_set ? 'salary_period' then v_set ->> 'salary_period' else t.salary_period end,
    bio                = case when v_set ? 'bio' then v_set ->> 'bio' else t.bio end,
    email_status       = case when v_set ? 'email' or (t.email_status is null and v_fields ? 'email_status'
                                                      and public.identity_email(v_fields ->> 'email') = public.identity_email(t.email))
                              then coalesce(v_fields ->> 'email_status', t.email_status) else t.email_status end,
    contact_emails     = case when v_contacts_changed then v_emails else t.contact_emails end,
    contact_phones     = case when v_contacts_changed then v_phones else t.contact_phones end,
    apollo_id          = coalesce(t.apollo_id, v_apollo_id),
    apollo_collected_at = case when v_fields ? 'apollo_collected_at' then coalesce(t.apollo_collected_at, now()) else t.apollo_collected_at end,
    profile_refreshed_at = case when p_source = 'apollo' and p_mode = 'refresh' and v_fields ? 'refreshed'
                                then now() else t.profile_refreshed_at end,
    field_provenance   = v_prov
  where t.id = p_candidate_id;

  perform set_config('gio.write_source', '', true);
  perform set_config('gio.write_actor', '', true);

  if v_job is not null then
    perform public.record_candidate_job_change(
      p_candidate_id, v_job ->> 'kind', v_job ->> 'old_title', v_job ->> 'old_company',
      v_job ->> 'new_title', v_job ->> 'new_company', p_source, p_actor);
  end if;

  return jsonb_build_object(
    'applied', coalesce((select jsonb_agg(k) from jsonb_object_keys(v_set) k), '[]'::jsonb),
    'kept', v_kept,
    'job_change', v_job);
end
$$;

revoke all on function public.apply_candidate_update_internal(uuid, text, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.apply_candidate_update_internal(uuid, text, jsonb, text, uuid) to service_role;

-- What callers use. Server functions may send any source; a signed-in
-- person may only send what a résumé says, for a candidate of their own
-- workspace.
create or replace function public.apply_candidate_update(
  p_candidate_id uuid,
  p_source text,
  p_fields jsonb,
  p_mode text default 'refresh',
  p_actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
begin
  if v_uid is not null then
    if p_source <> 'resume' then
      raise exception 'Only server functions can apply % data', p_source using errcode = '42501';
    end if;
    select c.tenant_id into v_tenant from public.candidates c where c.id = p_candidate_id;
    if v_tenant is null or not public.user_has_tenant_access(v_tenant) then
      raise exception 'Candidate not found' using errcode = '42501';
    end if;
  end if;
  return public.apply_candidate_update_internal(p_candidate_id, p_source, p_fields, p_mode, coalesce(v_uid, p_actor));
end
$$;

revoke all on function public.apply_candidate_update(uuid, text, jsonb, text, uuid) from public, anon;
grant execute on function public.apply_candidate_update(uuid, text, jsonb, text, uuid) to authenticated, service_role;

-- ── 7. Free refresh from Apollo search previews ───────────────────────────
-- Every Apollo preview Find caches carries a title and company. When it's
-- someone we already have, that refreshes them at no cost.
create or replace function public.sourcing_preview_refresh_candidate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_candidate uuid;
begin
  if new.apollo_id is null or (new.current_title is null and new.current_company is null) then
    return null;
  end if;
  if tg_op = 'UPDATE'
     and new.current_title is not distinct from old.current_title
     and new.current_company is not distinct from old.current_company then
    return null;
  end if;

  select o.tenant_id into v_tenant
  from public.sourcing_projects sp
  join public.organizations o on o.id = sp.organization_id
  where sp.id = new.sourcing_project_id;
  if v_tenant is null then return null; end if;

  select pi.candidate_id into v_candidate
  from public.person_identities pi
  join public.candidates c on c.id = pi.candidate_id
  where pi.tenant_id = v_tenant and pi.kind = 'apollo' and pi.value = btrim(new.apollo_id)
    and c.deleted_at is null and c.merged_into is null
  limit 1;
  if v_candidate is null then return null; end if;

  begin
    perform public.apply_candidate_update_internal(
      v_candidate, 'apollo_preview',
      jsonb_strip_nulls(jsonb_build_object(
        'role_current', nullif(btrim(new.current_title), ''),
        'company_current', nullif(btrim(new.current_company), ''))),
      'refresh', null);
  exception when others then
    raise warning 'Preview refresh of % failed: %', v_candidate, sqlerrm;
  end;
  return null;
end
$$;

revoke all on function public.sourcing_preview_refresh_candidate() from public, anon, authenticated;

create trigger sourcing_preview_refresh_candidate
  after insert or update of current_title, current_company on public.sourcing_preview_candidates
  for each row execute function public.sourcing_preview_refresh_candidate();

-- ── 8. Who the scheduled refresh picks ────────────────────────────────────
-- Active in an open job's pipeline or shortlisted, with something Apollo
-- can match on, and nothing fresher than 90 days. Oldest first.
create or replace function public.candidates_due_for_refresh(p_tenant uuid, p_limit integer)
returns table (candidate_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.candidates c
  where c.tenant_id = p_tenant
    and c.deleted_at is null and c.merged_into is null
    and (c.apollo_id is not null or public.linkedin_slug(c.linkedin_url) is not null
         or public.identity_email(c.email) is not null)
    and greatest(coalesce(c.profile_refreshed_at, '-infinity'::timestamptz),
                 coalesce(c.apollo_collected_at, '-infinity'::timestamptz),
                 c.created_at) < now() - interval '90 days'
    and (
      exists (
        select 1 from public.job_candidate_associations jca
        join public.jobs j on j.id = jca.job_id and j.status = 'open'
        where jca.candidate_id = c.id and jca.status in ('active', 'offer'))
      or exists (
        select 1 from public.sourcing_project_candidates s
        where s.candidate_id = c.id and s.status = 'shortlisted')
    )
  order by greatest(coalesce(c.profile_refreshed_at, '-infinity'::timestamptz),
                    coalesce(c.apollo_collected_at, '-infinity'::timestamptz),
                    c.created_at)
  limit greatest(0, least(p_limit, 500))
$$;

revoke all on function public.candidates_due_for_refresh(uuid, integer) from public, anon, authenticated;
grant execute on function public.candidates_due_for_refresh(uuid, integer) to service_role;

-- Daily at 12:15 UTC (6:15 in Guadalajara), before the pool builder.
select cron.schedule(
  'candidate-profile-refresh',
  '15 12 * * *',
  $cron$
  select net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/refresh-candidate-profiles',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pool-secret', (select ds.decrypted_secret from vault.decrypted_secrets ds where ds.name = 'pool_builder_secret')
    ),
    body := jsonb_build_object('mode', 'scheduled', 'source', 'pg_cron', 'at', now()),
    timeout_milliseconds := 150000
  );
  $cron$
);
