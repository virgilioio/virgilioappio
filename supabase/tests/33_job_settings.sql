-- Run after 20261019200000_job_settings inside a transaction that is rolled back.
-- Makes a fake Virgilio job and fake candidates, applies them through the rules,
-- restores one, moves one, and signs in as real users only to read and edit the
-- fake job's settings. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';   -- platform admin, connected mailbox
  admin_ constant uuid := 'e9bfab1d-5e9a-49d0-af89-5f97ef89b6fe';  -- workspace admin
  outsider constant uuid := '65689677-7b35-448e-9a37-89fb910413be'; -- no active membership
  org uuid := (select organization_id from public.jobs where tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'
                group by 1 order by count(*) desc limit 1);                -- a Virgilio department
  job uuid; ar uuid; st2 uuid; st_lib uuid;
  c_br uuid; c_rich uuid; c_low uuid; c_good uuid; c_manual uuid; c_accent uuid;
  a_br uuid; a_rich uuid; a_low uuid; a_good uuid; a_manual uuid; a_accent uuid;
  r record; n int; ok boolean; v text; t timestamptz;
begin
  -- Helpers -----------------------------------------------------------------------
  insert into t_results values ('country_name maps aliases and cities',
    public.country_name('México') = 'Mexico' and public.country_name('CDMX') = 'Mexico'
    and public.country_name('Zapopan') = 'Mexico' and public.country_name('USA') = 'United States'
    and public.country_name('LATAM') is null);
  insert into t_results values ('location_countries splits locations, regions name none',
    public.location_countries(array['Miguel Hidalgo - Ciudad de México', 'Austin, Texas']) = array['Mexico', 'United States']
    and public.location_countries(array['LATAM', 'Remote']) = '{}');

  -- A fake job (the creator is Allan), with its stages ---------------------------------
  insert into public.jobs (title, organization_id, tenant_id, location, additional_locations, status,
                           salary_min, salary_max, salary_period, currency, created_by)
  values ('TEST job settings', org, ten, 'Guadalajara, Jalisco', array['Ciudad de México'], 'draft',
          30000, 50000, 'monthly', 'MXN', allan)
  returning id into job;

  select hiring_countries into r from public.job_settings where job_id = job;
  insert into t_results values ('a new job gets its settings with the countries its locations name',
    found and r.hiring_countries = array['Mexico']);
  select count(*) into n from public.job_settings s where not exists (select 1 from public.jobs j where j.id = s.job_id);
  insert into t_results values ('every settings row belongs to a job', n = 0);
  select count(*) into n from public.jobs j where not exists (select 1 from public.job_settings s where s.job_id = j.id);
  insert into t_results values ('every job has a settings row', n = 0);

  select h.id into ar from public.job_hiring_stages h join public.job_stages s on s.id = h.stage_id
   where h.job_id = job and s.stage_type = 'application_review' limit 1;
  if ar is null then
    insert into public.job_hiring_stages (job_id, stage_id, position)
    values (job, 'b81e0fd7-16e8-48bb-b27e-dcf6b513c672', 1) returning id into ar;
  end if;
  select id into st_lib from public.job_stages where stage_type = 'screening' and is_active order by tenant_id nulls first limit 1;
  select h.id into st2 from public.job_hiring_stages h where h.job_id = job and h.id <> ar order by h.position limit 1;
  if st2 is null then
    insert into public.job_hiring_stages (job_id, stage_id, position) values (job, st_lib, 2) returning id into st2;
  end if;

  -- Allan is on the team as its recruiter (the app adds a job's creator), the admin as
  -- hiring manager.
  insert into public.job_assignments (job_id, user_id, organization_id, assigned_by, role)
  select job, allan, org, allan, 'recruiter'
   where not exists (select 1 from public.job_assignments where job_id = job and user_id = allan);
  insert into public.job_assignments (job_id, user_id, organization_id, assigned_by, role)
  values (job, admin_, org, allan, 'hiring_manager');

  update public.job_settings
     set reject_outside_countries = true, reject_salary_above = true,
         auto_reject_below = true, auto_reject_threshold = 40,
         notify_applications = true, notify_stage_moves = true
   where job_id = job;

  -- Fake candidates --------------------------------------------------------------------
  insert into public.candidates (candidate_name, email, location_country, tenant_id, organization_id)
  values ('TEST Brazil', 'test.brazil@example.com', 'Brazil', ten, ten) returning id into c_br;
  insert into public.candidates (candidate_name, email, location_country, salary_amount, salary_currency, salary_period, tenant_id, organization_id)
  values ('TEST Rich', 'test.rich@example.com', 'Mexico', 200000, 'MXN', 'monthly', ten, ten) returning id into c_rich;
  insert into public.candidates (candidate_name, email, location_country, salary_amount, salary_currency, salary_period, tenant_id, organization_id)
  values ('TEST Low score', 'test.low@example.com', 'Mexico', 600000, 'MXN', 'annually', ten, ten) returning id into c_low;
  insert into public.candidates (candidate_name, email, location_country, tenant_id, organization_id)
  values ('TEST Good', 'test.good@example.com', 'Mexico', ten, ten) returning id into c_good;
  insert into public.candidates (candidate_name, email, location_country, tenant_id, organization_id)
  values ('TEST Manual', 'test.manual@example.com', 'Brazil', ten, ten) returning id into c_manual;
  insert into public.candidates (candidate_name, email, location_country, tenant_id, organization_id)
  values ('TEST Accent', 'test.accent@example.com', 'México', ten, ten) returning id into c_accent;

  -- Applications ------------------------------------------------------------------------
  insert into public.job_candidate_associations (job_id, candidate_id, status, current_stage_id, applied_at)
  values (job, c_br, 'active', ar, now()) returning id into a_br;
  select * into r from public.job_candidate_associations where id = a_br;
  insert into t_results values ('outside the hiring countries: rejected by Gio',
    r.status = 'rejected' and r.auto_rejected_rule = 'country' and r.rejected_by is null
    and r.rejection_reason_id = '6a1d0c52-6f0e-4d1b-9a43-0b7f5c1e2a01' and r.rejection_notes like 'Gio: Applied from Brazil%');
  select scheduled_for, from_email, to_emails, status into r from public.scheduled_emails where association_id = a_br;
  insert into t_results values ('its email waits for 9:00 the next morning, from a connected mailbox',
    found and r.status = 'pending' and r.to_emails = array['test.brazil@example.com']
    and r.scheduled_for > now() and r.scheduled_for < now() + interval '34 hours'
    and extract(minute from r.scheduled_for) = 0
    and exists (select 1 from public.user_mail_identities i where i.email_address = r.from_email and i.is_active));
  insert into t_results values ('the association carries the same send time',
    (select rejection_email_scheduled_for from public.job_candidate_associations where id = a_br) = r.scheduled_for);
  select count(*) into n from public.activities
   where entity_id = c_br and title = 'Rejected by Gio' and metadata->>'job_id' = job::text and metadata->>'rule' = 'country';
  insert into t_results values ('the Activity feed shows Gio''s rejection', n = 1);

  insert into public.job_candidate_associations (job_id, candidate_id, status, current_stage_id, applied_at)
  values (job, c_accent, 'active', ar, now()) returning id into a_accent;
  insert into t_results values ('México matches Mexico: kept',
    (select status from public.job_candidate_associations where id = a_accent) = 'active');

  insert into public.job_candidate_associations (job_id, candidate_id, status, current_stage_id, applied_at)
  values (job, c_rich, 'active', ar, now()) returning id into a_rich;
  select * into r from public.job_candidate_associations where id = a_rich;
  insert into t_results values ('asking more than 25% over the top: rejected by Gio',
    r.status = 'rejected' and r.auto_rejected_rule = 'salary'
    and r.rejection_reason_id = '521b3c24-0312-411a-bbe3-72b183fa22a1');

  insert into public.job_candidate_associations (job_id, candidate_id, status, current_stage_id, applied_at)
  values (job, c_low, 'active', ar, now()) returning id into a_low;
  insert into t_results values ('600,000 a year is 50,000 a month, within the range: kept',
    (select status from public.job_candidate_associations where id = a_low) = 'active');

  insert into public.job_candidate_associations (job_id, candidate_id, status, current_stage_id, added_by)
  values (job, c_manual, 'active', ar, allan) returning id into a_manual;
  insert into t_results values ('added by hand, not applied: never screened',
    (select status from public.job_candidate_associations where id = a_manual) = 'active');

  insert into public.job_candidate_associations (job_id, candidate_id, status, current_stage_id, applied_at)
  values (job, c_good, 'active', ar, now()) returning id into a_good;

  -- Gio Fit -----------------------------------------------------------------------------
  update public.job_candidate_associations set ai_fit_score = 30 where id = a_low;
  select * into r from public.job_candidate_associations where id = a_low;
  insert into t_results values ('a first score under the bar: rejected by Gio',
    r.status = 'rejected' and r.auto_rejected_rule = 'score'
    and r.rejection_reason_id = '6a1d0c52-6f0e-4d1b-9a43-0b7f5c1e2a02');

  update public.job_candidate_associations set ai_fit_score = 80 where id = a_good;
  update public.job_candidate_associations set ai_fit_score = 10 where id = a_good;
  insert into t_results values ('a later score never rejects',
    (select status from public.job_candidate_associations where id = a_good) = 'active');

  update public.job_candidate_associations set ai_fit_score = 5 where id = a_manual;
  insert into t_results values ('a low score on a hand-added candidate never rejects',
    (select status from public.job_candidate_associations where id = a_manual) = 'active');

  -- Restoring ---------------------------------------------------------------------------
  update public.job_candidate_associations set status = 'active' where id = a_br;
  select * into r from public.job_candidate_associations where id = a_br;
  insert into t_results values ('restoring clears the send time and the rule',
    r.rejection_email_scheduled_for is null and r.auto_rejected_rule is null);
  insert into t_results values ('restoring cancels the waiting email',
    (select status from public.scheduled_emails where association_id = a_br) = 'cancelled');

  -- Notifications -----------------------------------------------------------------------
  select count(*), max((metadata->>'count')::int) into n, v
    from public.notifications where user_id = allan and job_id = job and category = 'application_batch';
  insert into t_results values ('the team gets one batched notification for the applications',
    n = 1 and v::int = 5);
  select count(*) into n from public.notifications where user_id = admin_ and job_id = job and category = 'application_batch';
  insert into t_results values ('every team member gets it', n = 1);
  select title into v from public.notifications where user_id = allan and job_id = job and category = 'application_batch';
  insert into t_results values ('the batch says how many', v = '5 new applications for TEST job settings');

  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  update public.job_candidate_associations set current_stage_id = st2 where id = a_good;
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from public.notifications
   where user_id = admin_ and job_id = job and category = 'candidate_update' and metadata->>'kind' = 'stage_move';
  select title into v from public.notifications
   where user_id = admin_ and job_id = job and category = 'candidate_update' and metadata->>'kind' = 'stage_move';
  insert into t_results values ('a stage move tells the team', n = 1 and v like '% moved TEST Good to %');
  select count(*) into n from public.notifications
   where user_id = allan and job_id = job and category = 'candidate_update' and metadata->>'kind' = 'stage_move';
  insert into t_results values ('the person who moved them is not told', n = 0);

  update public.job_settings set notify_stage_moves = false where job_id = job;
  update public.job_candidate_associations set current_stage_id = ar where id = a_good;
  select count(*) into n from public.notifications
   where user_id = admin_ and job_id = job and category = 'candidate_update' and metadata->>'kind' = 'stage_move';
  insert into t_results values ('with stage moves off, nobody is told', n = 1);

  -- Permissions -------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.job_settings set daily_digest = false, hiring_countries = array[' Mexico', 'Spain', 'Mexico']
   where job_id = job;
  get diagnostics n = row_count;
  insert into t_results values ('someone who can edit the job edits its settings', n = 1);
  reset role;
  select * into r from public.job_settings where job_id = job;
  insert into t_results values ('the edit is stamped and the countries tidied',
    r.updated_by = allan and r.daily_digest = false and r.hiring_countries = array['Mexico', 'Spain']);

  perform set_config('request.jwt.claims', json_build_object('sub', outsider, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.job_settings where job_id = job;
  update public.job_settings set daily_digest = true where job_id = job;
  get diagnostics v = row_count;
  insert into t_results values ('someone outside the workspace neither sees nor edits them', n = 0 and v::int = 0);
  begin
    insert into public.job_settings (job_id) values (gen_random_uuid());
    ok := false;
  exception when others then ok := true; end;
  insert into t_results values ('nobody adds settings rows by hand', ok);
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- The pay period ----------------------------------------------------------------------
  begin
    update public.jobs set salary_period = 'weekly' where id = job;
    ok := false;
  exception when check_violation then ok := true; end;
  insert into t_results values ('a pay period is monthly or annual', ok);
end $$;

select * from t_results;
