-- Run after 20261029180000_hiring_plan_order inside a transaction that is rolled back.
-- A hiring plan keeps its default stages first, in priority order
-- (Application Review, Final Candidate Review), then the team's stages.
--   Allan Bravo  admin
--   outsider     in the workspace, no seat on the job
-- Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

create or replace function pg_temp.as_user(_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.err_of(_sql text)
returns text
language plpgsql
as $$
begin
  execute _sql;
  return 'none';
exception when others then
  return sqlstate;
end $$;

create or replace function pg_temp.plan(_job uuid)
returns text
language sql
as $$
  select string_agg(h.position || ':' || s.stage_name, ' | ' order by h.position)
  from public.job_hiring_stages h join public.job_stages s on s.id = h.stage_id
  where h.job_id = _job
$$;

do $$
declare
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  outsider constant uuid := '4110ac77-f873-46f7-9bf2-c5774bfab028';
  itap constant uuid := 'cc0428c9-9ac4-433d-96c7-e00dd961cc8a';
  sdr_mm constant uuid := '127b8cdc-6c9b-4779-9fb5-2484443168d0';
  new_job uuid;
  ids uuid[];
  p text;
begin
  -- The plans that were out of order are right now.
  p := pg_temp.plan(itap);
  insert into t_results values ('the shared job reads AR, FCR, then its stages (' || p || ')',
    p = '1:Application Review | 2:Final Candidate Review | 3:Recruiter Screening | 4:Hiring Manager Interview | 5:Home Task / Assignment');
  p := pg_temp.plan(sdr_mm);
  insert into t_results values ('a job that started FCR-first reads AR first (' || p || ')',
    p like '1:Application Review | 2:Final Candidate Review | 3:Recruiter Screening%');
  insert into t_results values ('no plan is out of order or oddly numbered',
    not exists (select 1 from public.job_hiring_stages h
                join lateral public.job_plan_ranked(h.job_id) r on r.id = h.id
                where h.position <> r.rn));

  -- A new job gets the defaults in priority order.
  insert into public.jobs (title, organization_id, tenant_id, status, created_by)
  select 'zz plan order test', organization_id, tenant_id, 'draft', allan from public.jobs where id = itap
  returning id into new_job;
  p := pg_temp.plan(new_job);
  insert into t_results values ('a new job starts AR, FCR (' || p || ')',
    p = '1:Application Review | 2:Final Candidate Review');

  -- The editor asks for Recruiter Screening first: the defaults stay first.
  perform pg_temp.as_user(allan);
  select array_agg(h.id order by case when s.stage_name = 'Recruiter Screening' then 0 else 1 end, h.position) into ids
  from public.job_hiring_stages h join public.job_stages s on s.id = h.stage_id where h.job_id = itap;
  perform public.job_plan_order(itap, ids);
  perform set_config('role', 'postgres', true);
  p := pg_temp.plan(itap);
  insert into t_results values ('asking for a stage above the defaults keeps them first (' || p || ')',
    p like '1:Application Review | 2:Final Candidate Review | 3:Recruiter Screening%');

  -- The team's stages take the order asked.
  perform pg_temp.as_user(allan);
  select array_agg(h.id order by case s.stage_name when 'Home Task / Assignment' then 0 else 1 end, h.position) into ids
  from public.job_hiring_stages h join public.job_stages s on s.id = h.stage_id where h.job_id = itap;
  perform public.job_plan_order(itap, ids);
  perform set_config('role', 'postgres', true);
  p := pg_temp.plan(itap);
  insert into t_results values ('the team''s stages take the order asked (' || p || ')',
    p = '1:Application Review | 2:Final Candidate Review | 3:Home Task / Assignment | 4:Recruiter Screening | 5:Hiring Manager Interview');

  -- A save that doesn't name every stage, or names one twice, changes nothing.
  perform pg_temp.as_user(allan);
  insert into t_results values ('a save missing a stage is refused',
    pg_temp.err_of(format('select public.job_plan_order(%L, %L)', itap, ids[1:4])) = 'GPL01');
  insert into t_results values ('a save naming a stage twice is refused',
    pg_temp.err_of(format('select public.job_plan_order(%L, %L)', itap, ids[1:4] || ids[1])) = 'GPL01');
  insert into t_results values ('a save naming another job''s stage is refused',
    pg_temp.err_of(format('select public.job_plan_order(%L, %L)', itap,
      ids[1:4] || (select h.id from public.job_hiring_stages h where h.job_id = sdr_mm limit 1))) = 'GPL01');
  perform set_config('role', 'postgres', true);

  -- Only the job's managers.
  perform pg_temp.as_user(outsider);
  insert into t_results values ('someone without a seat can''t reorder it',
    pg_temp.err_of(format('select public.job_plan_order(%L, %L)', itap, ids)) = 'GPL02');
  insert into t_results values ('nobody calls the inner step directly',
    pg_temp.err_of(format('select public.job_plan_apply(%L)', itap)) = '42501');
  perform set_config('role', 'postgres', true);

  p := pg_temp.plan(itap);
  insert into t_results values ('refused saves left it as it was',
    p = '1:Application Review | 2:Final Candidate Review | 3:Home Task / Assignment | 4:Recruiter Screening | 5:Hiring Manager Interview');
end $$;

do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n' order by ok, check_name) into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
