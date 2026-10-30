-- Run after 20261027211950_offers_hiring_team_only inside a transaction that is rolled back.
-- Offers, their approvals and the job's agreements are for admins and the
-- job's Recruiter and Hiring manager seats (plus the offer's approvers).
-- Uses Leon Kiers' offer on Sales Development Representative:
--   Victoria Bravo  Recruiter on the job              sees it
--   Erik Veen       Hiring manager and approver       sees it
--   Allan Bravo     admin (interviewer seat here)     sees it
--   Jurre Veen      Interviewer on the job            sees nothing
--   Melissa Perez   Recruiter on another open job     sees nothing
--   Ritika S.       Sourcer (talent pool seat)        sees nothing
-- Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  req constant uuid := '56a7780e-913f-493d-ad3b-a70c5958e199';
  offer constant uuid := '05c8d06f-27e8-490d-b239-83d5b8ab4ce6';
  job constant uuid := '4b881217-ff38-499c-b566-6ec627d9e844';
  cand constant uuid := 'b9c93da8-4789-4d82-9a27-494032783e41';
  victoria constant uuid := '61148617-e4e6-4d72-9176-67b203e98aae';
  erik constant uuid := '71fb2937-3df8-4dfa-b065-aaaa5ee64af8';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  jurre constant uuid := '7e274af6-466f-41b1-91a5-04b479e6c2ed';
  melissa constant uuid := '4110ac77-f873-46f7-9bf2-c5774bfab028';
  ritika constant uuid := '7bd8d034-ad3c-4dbf-af0f-ac9155b2f3c2';
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  who record;
  n_offer int;
  n_req int;
  n_steps int;
  n_trail int;
  can boolean;
  sends boolean;
  err text;
  changed int;
begin
  for who in
    select * from (values
      (victoria, 'a Recruiter on the job', true),
      (erik, 'the Hiring manager (an approver)', true),
      (allan, 'an admin', true),
      (jurre, 'an Interviewer on the job', false),
      (melissa, 'a Recruiter on another job', false),
      (ritika, 'a Sourcer', false)
    ) v(uid, label, sees)
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', who.uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n_offer from public.offer_letters where id = offer;
    select count(*) into n_req from public.offer_approval_requests where id = req;
    select count(*) into n_steps from public.offer_approval_request_steps where request_id = req;
    can := public.can_view_job_offers(job);
    sends := public.sign_can_send(ten, 'candidate', job);
    begin
      select count(*) into n_trail from public.get_candidate_activities(cand, job) a
      where a.metadata->>'source' = 'offer_trail' or a.activity_type::text ~ '^(offer_|approval_|agreement_)';
    exception when others then
      n_trail := -1; -- people without workspace-wide access can't read the feed at all
    end;
    perform set_config('role', 'postgres', true);

    if who.sees then
      insert into t_results values (who.label || ' sees the offer', n_offer = 1);
      insert into t_results values (who.label || ' sees its approval request and steps', n_req = 1 and n_steps = 4);
      insert into t_results values (who.label || ' passes the rule', can);
    else
      insert into t_results values (who.label || ' doesn''t see the offer', n_offer = 0);
      insert into t_results values (who.label || ' doesn''t see its approval', n_req = 0 and n_steps = 0);
      insert into t_results values (who.label || ' fails the rule', not can);
      insert into t_results values (who.label || ' can''t send the candidate an agreement', not sends);
      insert into t_results values (who.label || ' sees no offer entries in the feed', n_trail <= 0);
    end if;
  end loop;

  -- The recruiter and the admin also see the offer entries in the feed.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n_trail from public.get_candidate_activities(cand, job) a
  where a.metadata->>'source' = 'offer_trail' or a.activity_type::text ~ '^(offer_|approval_|agreement_)';
  perform set_config('role', 'postgres', true);
  insert into t_results values ('the admin still sees the offer entries in the feed', n_trail > 0);

  perform set_config('request.jwt.claims', json_build_object('sub', victoria, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n_trail from public.get_candidate_activities(cand, job) a
  where a.metadata->>'source' = 'offer_trail' or a.activity_type::text ~ '^(offer_|approval_|agreement_)';
  sends := public.sign_can_send(ten, 'candidate', job);
  perform set_config('role', 'postgres', true);
  insert into t_results values ('the job''s Recruiter still sees the offer entries in the feed', n_trail > 0);
  -- Everything else in the feed is untouched: the Recruiter sees every other entry.
  perform set_config('request.jwt.claims', json_build_object('sub', victoria, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n_offer from public.get_candidate_activities(cand, job) a
  where not (coalesce(a.metadata->>'source', '') = 'offer_trail' or a.activity_type::text ~ '^(offer_|approval_|agreement_)');
  perform set_config('role', 'postgres', true);
  insert into t_results values ('the rest of the feed still shows (' || n_offer || ' entries)',
    n_offer > 0 and n_offer >= (select count(*) from public.activities a
      where ((a.entity_type = 'candidate' and a.entity_id = cand) or a.metadata @> jsonb_build_object('candidate_id', cand::text))
        and a.metadata @> jsonb_build_object('job_id', job::text)
        and not (coalesce(a.metadata->>'source', '') = 'offer_trail' or a.activity_type::text ~ '^(offer_|approval_|agreement_)')));
  insert into t_results values ('the job''s Recruiter can still send the candidate an agreement', sends);

  -- Changing an offer: Melissa (recruiter elsewhere) used to be able to; now nothing changes.
  perform set_config('request.jwt.claims', json_build_object('sub', melissa, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update public.offer_letters set title = coalesce(title, '') where id = offer;
  get diagnostics changed = row_count;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('a Recruiter on another job can''t change the offer', changed = 0);

  -- Victoria (the job's Recruiter) still can.
  perform set_config('request.jwt.claims', json_build_object('sub', victoria, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update public.offer_letters set title = coalesce(title, '') where id = offer;
  get diagnostics changed = row_count;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('the job''s Recruiter can still change the offer', changed = 1);

  -- Erik decides through offer_approval_decide, which still works.
  perform set_config('request.jwt.claims', json_build_object('sub', erik, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.offer_approval_decide(
      (select id from public.offer_approval_request_steps where request_id = req and approver_user_id = erik),
      'approved', null);
    err := 'none';
  exception when others then err := sqlstate || ' ' || sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('the approver still decides their step', err = 'none');

  insert into t_results values ('anon can''t call the rule',
    not has_function_privilege('anon', 'public.can_view_job_offers(uuid)', 'execute'));
end $$;

-- Raise the results so the whole run rolls back, wherever it runs.
do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n') into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
