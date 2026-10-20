-- Run after 20261020182518_job_create_fixes inside a transaction that is rolled back.
-- Signs in as Allan (an active member) to create a fake draft job the way the app
-- does, then checks its setup list and the publish gate. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  org uuid := (select organization_id from public.jobs where tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'
                group by 1 order by count(*) desc limit 1);
  job uuid; c jsonb; ok boolean; msg text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- Creating a job as a signed-in member -------------------------------------------
  begin
    insert into public.jobs (title, organization_id, tenant_id, status, priority, currency, work_mode,
                             employment_type, location, description, show_salary_public, created_by)
    values ('TEST job create', org, ten, 'draft', 'standard', 'USD', 'remote', 'full_time', 'Remote',
            'Fake job for a rolled-back test.', false, allan)
    returning id into job;
    ok := job is not null;
  exception when others then ok := false; msg := sqlerrm; end;
  insert into t_results values ('a signed-in member can create a job' || coalesce(' (' || msg || ')', ''), ok);

  insert into t_results values ('the creator joins the job team as recruiter',
    exists (select 1 from public.job_assignments where job_id = job and user_id = allan and role = 'recruiter'));

  -- The setup list names what is missing ---------------------------------------------
  begin
    c := public.job_setup_checks(job);
    -- No department and no openings yet; the default plan and the creator are already there.
    ok := c -> 'missing' = '["Job info", "Openings", "Sourcing Partner"]'::jsonb;
  exception when others then ok := false; end;
  insert into t_results values ('the setup list names what is missing, the creator counts as TA Partner', ok);

  -- Publishing an unready draft says what is missing -------------------------------
  msg := null;
  begin
    update public.jobs set status = 'open' where id = job;
    ok := false;
  exception when others then msg := sqlerrm; end;
  insert into t_results values ('publishing an unready draft is refused with what is missing',
    msg = 'Complete the setup before publishing: Job info, Openings, Sourcing Partner.');

  -- A second recruiter row for the same person is still one row ------------------------
  insert into public.job_assignments (job_id, user_id, organization_id, assigned_by, role)
  values (job, allan, org, allan, 'recruiter') on conflict (job_id, user_id, role) do nothing;
  insert into t_results values ('the creator is on the team once',
    (select count(*) from public.job_assignments where job_id = job and user_id = allan and role = 'recruiter') = 1);

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

select * from t_results;
