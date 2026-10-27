-- Run after 20261027212019_jobs_managed_by_recruiter inside a transaction that is rolled back.
-- Admins and a job's Recruiter manage it: details, openings, hiring plan
-- (stages and their interviewers), settings and the client view. A Sourcer
-- keeps their own job's details. Nobody else changes any of it.
-- Jobs: Sales Development Representative (SDR) and the open job where
-- Melissa Perez is Recruiter and Ritika S. is Sourcer (OTHER).
--   Victoria Bravo  Recruiter on SDR                   manages SDR
--   Allan Bravo     admin                              manages SDR
--   Erik Veen       Hiring manager on SDR              changes nothing
--   Jurre Veen      Interviewer on SDR                 changes nothing
--   Melissa Perez   Recruiter on OTHER, not on SDR     changes nothing on SDR, manages OTHER
--   Ritika S.       Sourcer on OTHER                   OTHER's details only
-- Every row's ok is true. Each change is a no-op write, counted by rows touched.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

create or replace function pg_temp.touches(_uid uuid, _job uuid)
returns jsonb
language plpgsql
as $$
declare
  n int;
  r jsonb := '{}';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update public.jobs set title = title where id = _job;
  get diagnostics n = row_count; r := r || jsonb_build_object('job', n);
  update public.job_openings set updated_at = updated_at where job_id = _job;
  get diagnostics n = row_count; r := r || jsonb_build_object('openings', n);
  update public.job_hiring_stages set updated_at = updated_at where job_id = _job;
  get diagnostics n = row_count; r := r || jsonb_build_object('stages', n);
  update public.stage_interviewer_assignments s set assignment_type = s.assignment_type
    from public.job_hiring_stages h where h.id = s.job_hiring_stage_id and h.job_id = _job;
  get diagnostics n = row_count; r := r || jsonb_build_object('stage_interviewers', n);
  update public.job_settings set job_id = job_id where job_id = _job;
  get diagnostics n = row_count; r := r || jsonb_build_object('settings', n);
  update public.job_pipeline_shares set is_public = is_public where job_id = _job;
  get diagnostics n = row_count; r := r || jsonb_build_object('client_view', n);
  perform set_config('role', 'postgres', true);
  return r;
end $$;

do $$
declare
  sdr constant uuid := '4b881217-ff38-499c-b566-6ec627d9e844';
  other constant uuid := 'afd14389-9945-4b33-b81a-65104e0335a8';
  victoria constant uuid := '61148617-e4e6-4d72-9176-67b203e98aae';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  erik constant uuid := '71fb2937-3df8-4dfa-b065-aaaa5ee64af8';
  jurre constant uuid := '7e274af6-466f-41b1-91a5-04b479e6c2ed';
  melissa constant uuid := '4110ac77-f873-46f7-9bf2-c5774bfab028';
  ritika constant uuid := '7bd8d034-ad3c-4dbf-af0f-ac9155b2f3c2';
  full_sdr jsonb;
  t jsonb;
  k text;
  who record;
begin
  -- What SDR has, as the database owner sees it.
  full_sdr := jsonb_build_object(
    'job', 1,
    'openings', (select count(*) from public.job_openings where job_id = sdr),
    'stages', (select count(*) from public.job_hiring_stages where job_id = sdr),
    'stage_interviewers', (select count(*) from public.stage_interviewer_assignments s join public.job_hiring_stages h on h.id = s.job_hiring_stage_id where h.job_id = sdr),
    'settings', (select count(*) from public.job_settings where job_id = sdr),
    'client_view', (select count(*) from public.job_pipeline_shares where job_id = sdr));

  for who in
    select * from (values
      (victoria, 'the job''s Recruiter', true),
      (allan, 'an admin', true),
      (erik, 'the Hiring manager', false),
      (jurre, 'an Interviewer', false),
      (melissa, 'a Recruiter on another job', false),
      (ritika, 'a Sourcer on another job', false)
    ) v(uid, label, manages)
  loop
    t := pg_temp.touches(who.uid, sdr);
    for k in select jsonb_object_keys(full_sdr) loop
      if who.manages then
        insert into t_results values (who.label || ' changes the ' || replace(k, '_', ' '), t->k = full_sdr->k);
      else
        insert into t_results values (who.label || ' can''t change the ' || replace(k, '_', ' '), (t->>k)::int = 0);
      end if;
    end loop;
  end loop;

  -- Melissa manages her own job; Ritika (its Sourcer) changes its details only.
  t := pg_temp.touches(melissa, other);
  insert into t_results values ('a Recruiter manages their own job (details, settings)', (t->>'job')::int = 1 and (t->>'settings')::int = 1);
  t := pg_temp.touches(ritika, other);
  insert into t_results values ('a Sourcer still changes their job''s details', (t->>'job')::int = 1);
  insert into t_results values ('a Sourcer can''t change openings, stages, settings or the client view',
    (t->>'openings')::int = 0 and (t->>'stages')::int = 0 and (t->>'stage_interviewers')::int = 0
    and (t->>'settings')::int = 0 and (t->>'client_view')::int = 0);

  -- The hiring team: the Recruiter adds an interviewer, not a Recruiter.
  perform set_config('request.jwt.claims', json_build_object('sub', victoria, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into t_results values ('the job''s Recruiter adds interviewers and hiring managers',
    public.can_manage_job_team(sdr, 'interviewer') and public.can_manage_job_team(sdr, 'hiring_manager'));
  insert into t_results values ('Recruiter and Sourcer seats stay with admins',
    not public.can_manage_job_team(sdr, 'recruiter') and not public.can_manage_job_team(sdr, 'sourcer'));
  perform set_config('role', 'postgres', true);

  insert into t_results values ('Mark hired runs with its own checks',
    (select prosecdef from pg_proc where oid = 'public.mark_hired(uuid, uuid, date, boolean, uuid, uuid)'::regprocedure));
  insert into t_results values ('anon can''t call the rule',
    not has_function_privilege('anon', 'public.can_manage_job(uuid)', 'execute'));
end $$;

-- Raise the results so the whole run rolls back, wherever it runs.
do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n') into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
