-- Run after 20261022230000_talent_pool_rule inside a transaction that is rolled back.
-- Reads as real people (no rows are added): a sourcer and an admin get the whole
-- talent pool; a hiring manager and an interviewer get only their own jobs;
-- deactivated people and a member whose seats are taken away get nothing.
-- Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  ritika constant uuid := '7bd8d034-ad3c-4dbf-af0f-ac9155b2f3c2';  -- sourcer, open job
  malena constant uuid := (select m.user_id from public.members m join public.profiles p on p.user_id = m.user_id
                            where p.email = 'malena@virgilio.tech' and m.tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab' limit 1);  -- admin
  alex constant uuid := 'dc2c4b7a-8e4e-4ca4-b588-f05b2d3f7378';    -- client hiring manager
  jurre constant uuid := '7e274af6-466f-41b1-91a5-04b479e6c2ed';   -- interviewer
  mitzy constant uuid := '732a3bae-e479-4b66-91e1-39b545716c1c';   -- interviewer on a closed job
  zara constant uuid := '62f47cb4-0163-4e36-949b-8f87ae41545e';    -- deactivated, recruiter seats
  motive constant uuid := '65689677-7b35-448e-9a37-89fb910413be';  -- deactivated owner, 7 open jobs
  all_cands int := (select count(*) from public.candidates where tenant_id = ten and deleted_at is null);
  all_jobs int := (select count(*) from public.jobs where tenant_id = ten and deleted_at is null);
  alex_jobs int := (select count(*) from public.job_assignments where user_id = 'dc2c4b7a-8e4e-4ca4-b588-f05b2d3f7378' and deleted_at is null);
  alex_cands int := (select count(distinct a.candidate_id) from public.job_candidate_associations a
                      join public.candidates c on c.id = a.candidate_id and c.deleted_at is null
                      where a.job_id in (select job_id from public.job_assignments where user_id = 'dc2c4b7a-8e4e-4ca4-b588-f05b2d3f7378' and deleted_at is null));
  jurre_jobs int := (select count(distinct job_id) from public.job_assignments where user_id = '7e274af6-466f-41b1-91a5-04b479e6c2ed' and deleted_at is null);
  zara_cand uuid := (select a.candidate_id from public.job_candidate_associations a
                      where a.job_id in (select job_id from public.job_assignments where user_id = '62f47cb4-0163-4e36-949b-8f87ae41545e') limit 1);
  n int; m int; ok boolean;
begin
  insert into t_results values ('every workspace has the job-based access switch on',
    not exists (select 1 from public.tenants where coalesce((settings->>'job_based_access')::boolean, false) = false));

  -- A sourcer on an open job: the whole pool -------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', ritika, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into t_results values ('sourcer: talent pool open', public.has_workspace_wide_access(ten));
  insert into t_results values ('sourcer: sees every candidate', (select count(*) from public.candidates where tenant_id = ten) = all_cands);
  insert into t_results values ('sourcer: sees every job', (select count(*) from public.jobs where tenant_id = ten) = all_jobs);
  execute 'reset role';

  -- An admin: the whole pool ------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', malena, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into t_results values ('admin: talent pool open and every candidate',
    public.has_workspace_wide_access(ten) and (select count(*) from public.candidates where tenant_id = ten) = all_cands);
  execute 'reset role';

  -- A hiring manager: their job only -----------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', alex, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into t_results values ('hiring manager: no talent pool', not public.has_workspace_wide_access(ten));
  insert into t_results values ('hiring manager: only their job', (select count(*) from public.jobs) = alex_jobs);
  insert into t_results values ('hiring manager: only their job''s candidates', (select count(*) from public.candidates) = alex_cands);
  insert into t_results values ('hiring manager: no pipeline rows from other jobs',
    not exists (select 1 from public.job_candidate_associations where job_id not in (select public.my_job_ids())));
  insert into t_results values ('hiring manager: no searches, no other jobs'' scorecards',
    not exists (select 1 from public.sourcing_projects)
    and not exists (select 1 from public.job_stage_scorecards where job_id not in (select public.my_job_ids())));
  execute 'reset role';

  -- An interviewer: their jobs only ------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', jurre, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into t_results values ('interviewer: no talent pool, only their jobs',
    not public.has_workspace_wide_access(ten) and (select count(*) from public.jobs) = jurre_jobs);
  insert into t_results values ('interviewer: only their jobs'' candidates',
    not exists (select 1 from public.candidates c
                where not exists (select 1 from public.job_candidate_associations a
                                  where a.candidate_id = c.id and a.job_id in (select public.my_job_ids()))));
  execute 'reset role';

  -- A deactivated recruiter: nothing ----------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', zara, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into t_results values ('deactivated recruiter: no talent pool', not public.has_workspace_wide_access(ten));
  insert into t_results values ('deactivated recruiter: no jobs, candidates or pipeline rows',
    not exists (select 1 from public.jobs) and not exists (select 1 from public.candidates)
    and not exists (select 1 from public.job_candidate_associations) and not exists (select public.my_job_ids()));
  insert into t_results values ('deactivated recruiter: no files, emails, scorecards or offers',
    not exists (select 1 from public.candidate_attachments) and not exists (select 1 from public.email_logs)
    and not exists (select 1 from public.job_stage_scorecards) and not exists (select 1 from public.offer_letters));
  execute 'reset role';
  insert into t_results values ('deactivated recruiter: user_can_see_candidate says no',
    zara_cand is not null and not public.user_can_see_candidate(zara, zara_cand));

  -- A deactivated owner of another workspace: nothing -----------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', motive, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into t_results values ('deactivated owner elsewhere: no jobs or candidates',
    not exists (select 1 from public.jobs) and not exists (select 1 from public.candidates));
  execute 'reset role';

  -- A member whose seats are taken away: nothing ----------------------------------------
  update public.job_assignments set deleted_at = now() where user_id = mitzy and deleted_at is null;
  perform set_config('request.jwt.claims', json_build_object('sub', mitzy, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into t_results values ('member with no seats: no jobs, candidates or pipeline rows',
    not exists (select 1 from public.jobs) and not exists (select 1 from public.candidates)
    and not exists (select 1 from public.job_candidate_associations) and not public.has_workspace_wide_access(ten));
  execute 'reset role';

  -- The sourcer, deactivated: the seat stops counting -------------------------------------
  update public.members set user_status = 'inactive' where user_id = ritika and tenant_id = ten;
  perform set_config('request.jwt.claims', json_build_object('sub', ritika, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into t_results values ('sourcer deactivated: no talent pool and no candidates',
    not public.has_workspace_wide_access(ten) and not exists (select 1 from public.candidates));
  execute 'reset role';
end $$;
