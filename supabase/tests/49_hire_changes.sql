-- Run after 20261023031128_hire_changes_admin_only inside a transaction that is rolled back.
-- On REQ-1101 (a filled Gio Sales opening): someone on the job who isn't an
-- admin can't undo the hire, change its credit or edit the hire columns; an
-- admin changes the credit and undoes the hire through the functions only,
-- each change reaches Gio Sales' outbox with the credited people, and Mark
-- hired still works. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  sourcer constant uuid := 'd294b6a2-3736-43f6-b8c3-d85845fcbe89';
  mate constant uuid := '732a3bae-e479-4b66-91e1-39b545716c1c';
  op constant uuid := '69abd0c1-e5b8-4c20-9e9b-3d2e073465b2';
  job constant uuid := '8c712a45-293a-4b0b-ad6c-7896375173b2';
  app constant uuid := '975b671f-1776-471a-8c4c-97f567a705de';
  n int;
  row_ public.job_openings%rowtype;
  ev jsonb;
begin
  insert into t_results values ('the fixture: REQ-1101 is filled and credited',
    (select hired_association_id = app and sourcer_user_id = sourcer and recruiter_user_id = allan
       from public.job_openings where id = op));
  insert into t_results values ('the fixture: the interviewer is not an admin',
    (select system_role::text <> 'admin' from public.members where user_id = mate and tenant_id =
       (select tenant_id from public.jobs where id = job)));

  -- 1. Someone on the job who isn't an admin.
  perform set_config('request.jwt.claims', json_build_object('sub', mate, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into t_results values ('a non-admin is not allowed to change a hire', public.can_change_hire(job) = false);
  begin
    perform public.change_hire_credit(op, sourcer, allan);
    insert into t_results values ('a non-admin can''t change the credit', false);
  exception when insufficient_privilege then
    insert into t_results values ('a non-admin can''t change the credit', true);
  end;
  begin
    perform public.unmark_hired(app);
    insert into t_results values ('a non-admin can''t undo the hire', false);
  exception when insufficient_privilege then
    insert into t_results values ('a non-admin can''t undo the hire', true);
  end;
  begin
    update public.job_openings set sourcer_user_id = mate where id = op;
    insert into t_results values ('a non-admin can''t write the credited Sourcer directly',
      (select sourcer_user_id = sourcer from public.job_openings where id = op));
  exception when sqlstate 'GHC01' then
    insert into t_results values ('a non-admin can''t write the credited Sourcer directly', true);
  end;
  begin
    update public.job_openings set hired_association_id = null, filled_at = null where id = op;
    insert into t_results values ('a non-admin can''t empty a filled opening directly',
      (select hired_association_id = app from public.job_openings where id = op));
  exception when sqlstate 'GHC01' then
    insert into t_results values ('a non-admin can''t empty a filled opening directly', true);
  end;
  begin
    insert into public.job_openings (job_id, req_id, target_hire_date, target_start_date, filled_at)
    values (job, 'TEST-GHC', current_date, current_date, now());
    insert into t_results values ('a new opening can''t start filled', false);
  exception when sqlstate 'GHC01' then
    insert into t_results values ('a new opening can''t start filled', true);
  end;
  update public.job_openings set target_start_date = target_start_date + 1 where id = op;
  insert into t_results values ('people on the job still edit the dates',
    (select target_start_date > target_hire_date from public.job_openings where id = op));

  -- 2. The interviewer becomes a second Sourcer on the job.
  perform set_config('role', 'postgres', true);
  update public.job_assignments set role = 'sourcer' where job_id = job and user_id = mate and deleted_at is null;

  -- 3. An admin.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into t_results values ('an admin is allowed to change a hire', public.can_change_hire(job));
  begin
    update public.job_openings set sourcer_user_id = mate where id = op;
    insert into t_results values ('an admin can''t write the hire columns directly either', false);
  exception when sqlstate 'GHC01' then
    insert into t_results values ('an admin can''t write the hire columns directly either', true);
  end;
  begin
    perform public.change_hire_credit(op, allan, allan);
    insert into t_results values ('the new Sourcer must be a Sourcer on the job', false);
  exception when others then
    insert into t_results values ('the new Sourcer must be a Sourcer on the job', sqlerrm = 'That person is not a Sourcer on this job.');
  end;

  perform public.change_hire_credit(op, mate, allan);
  select * into row_ from public.job_openings where id = op;
  insert into t_results values ('an admin changes the Sourcer and keeps the hire',
    row_.sourcer_user_id = mate and row_.recruiter_user_id = allan and row_.hired_association_id = app);
  insert into t_results values ('the change is in the candidate''s activity',
    exists (select 1 from public.activities a where a.title = 'Hire credit changed · REQ-1101' and a.user_id = allan
            and a.description like 'Sourcer: % → %.' and (a.metadata->>'previousSourcerId')::uuid = sourcer));
  perform public.change_hire_credit(op, mate, allan);

  perform public.unmark_hired(app);
  select * into row_ from public.job_openings where id = op;
  insert into t_results values ('an admin undoes the hire: the opening is empty again',
    row_.hired_association_id is null and row_.filled_at is null and row_.sourcer_user_id is null and row_.recruiter_user_id is null);
  insert into t_results values ('the candidate is back at the offer stage',
    (select status::text = 'offer' and hired_at is null from public.job_candidate_associations where id = app));
  insert into t_results values ('the undo is in the candidate''s activity',
    exists (select 1 from public.activities a where a.title = 'Hire undone · REQ-1101 reopened' and a.user_id = allan));
  begin
    perform public.change_hire_credit(op, mate, allan);
    insert into t_results values ('an empty opening has no credit to change', false);
  exception when others then
    insert into t_results values ('an empty opening has no credit to change', sqlerrm like 'REQ-1101 isn''t filled%');
  end;

  perform public.mark_hired(app, op, current_date, false, sourcer, allan);
  select * into row_ from public.job_openings where id = op;
  insert into t_results values ('Mark hired still fills the opening and records both people',
    row_.hired_association_id = app and row_.sourcer_user_id = sourcer and row_.recruiter_user_id = allan);
  insert into t_results values ('the guard is closed again after Mark hired',
    coalesce(current_setting('gio.hire_write', true), '') <> 'on');

  -- 4. What Gio Sales was sent in this transaction (the outbox is read as the owner).
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.integration_outbox
   where event = 'opening.credit_changed' and payload->'opening'->>'opening_id' = op::text and created_at >= now();
  insert into t_results values ('one credit change is sent, saving the same people again sends nothing', n = 1);
  select payload into ev from public.integration_outbox
   where event = 'opening.credit_changed' and payload->'opening'->>'opening_id' = op::text and created_at >= now();
  insert into t_results values ('Gio Sales is told the new Sourcer and the Recruiter',
    ev->'hire_team'->'sourcer'->>'id' = mate::text and ev->'hire_team'->'recruiter'->>'id' = allan::text
    and ev->'opening'->>'status' = 'filled');
  select payload into ev from public.integration_outbox
   where event = 'opening.unfilled' and payload->'opening'->>'opening_id' = op::text and created_at >= now();
  insert into t_results values ('Gio Sales is told the hire was undone',
    ev is not null and ev->'opening'->>'status' in ('open', 'offer') and ev->'hire_team' = 'null'::jsonb);
  select payload into ev from public.integration_outbox
   where event = 'opening.filled' and payload->'opening'->>'opening_id' = op::text and created_at >= now();
  insert into t_results values ('the new hire reaches Gio Sales with both people',
    ev->'hire_team'->'sourcer'->>'id' = sourcer::text and ev->'hire_team'->'recruiter'->>'id' = allan::text);
end $$;

select * from t_results;
