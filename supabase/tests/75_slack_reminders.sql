-- Run after 20261028051646_slack_reminders inside a transaction that is rolled back.
-- Slack reminders: "An offer is still waiting for approval" goes only to the
-- approver whose turn it is, every N days from when the turn began, and at
-- once on Remind; "A scorecard is due" goes only to the interviewer who owes
-- it, once when the interview ends and then every N days, and at once on
-- Request; neither is sent once it's no longer needed.
-- Job: Sales Development Representative (SDR), with a fake offer, approval
-- chain and interview; one of its stages is made to require a scorecard.
--   Allan Bravo     admin           sets up offer reminders
--   Victoria Bravo  Recruiter       sets up the job's scorecard reminders, asks for approval
--   Erik Veen       approver 1      Jurre Veen  approver 2, and the interviewer
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

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  sdr constant uuid := '4b881217-ff38-499c-b566-6ec627d9e844';
  hm_stage constant uuid := '1c2cf31a-32a8-4599-a5a9-d3ff6ba078f7';
  victoria constant uuid := '61148617-e4e6-4d72-9176-67b203e98aae';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  erik constant uuid := '71fb2937-3df8-4dfa-b065-aaaa5ee64af8';
  jurre constant uuid := '7e274af6-466f-41b1-91a5-04b479e6c2ed';
  approver constant jsonb := '[{"type":"role","role":"approver"}]';
  interviewer constant jsonb := '[{"type":"role","role":"interviewer"}]';
  chan constant jsonb := '[{"type":"channel","id":"C0HIRING01","name":"hiring"}]';
  wait_auto uuid;
  card_auto uuid;
  assoc uuid;
  cand uuid;
  ol uuid;
  req uuid;
  s1 uuid;
  s2 uuid;
  bk uuid;
  n int;
  mc jsonb;
begin
  -- Slack connected (a stand-in token, rolled back with everything else).
  perform public.slack_connection_save(ten, allan,
    '{"team_id":"T0TEST0001","team_name":"Virgilio","bot_user_id":"U0GIOBOT01","scopes":["chat:write"]}', 'xoxb-stand-in');

  -- Who may set them up, and how.
  perform pg_temp.as_user(allan);
  wait_auto := public.slack_save_automation(null, ten, null, null, 'offer.approval_waiting', '{"every_days": 2}', approver,
    'Hi {approver}! The offer for {candidate} has waited {waiting}. {offer_link}');
  insert into t_results values ('an admin sets up approval reminders every 2 days', wait_auto is not null);
  insert into t_results values ('approval reminders need how often',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'offer.approval_waiting', '{}', %L, 'x')$q$, ten, approver)) = 'GSL04');
  insert into t_results values ('approval reminders repeat every 1, 2 or 3 days only',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'offer.approval_waiting', '{"every_days": 7}', %L, 'x')$q$, ten, approver)) = 'GSL04');
  insert into t_results values ('approval reminders go only to the approver',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'offer.approval_waiting', '{"every_days": 1}', %L, 'x')$q$, ten, chan)) = 'GSL04');
  insert into t_results values ('nothing else repeats',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'candidate.hired', '{"every_days": 1}', %L, 'x')$q$, ten, chan)) = 'GSL04');
  insert into t_results values ('profile reminders keep 3, 5, 7 or 14 days',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'member.profile_incomplete', '{"every_days": 2}', '[{"type":"role","role":"member"}]', 'x')$q$, ten)) = 'GSL04');
  perform set_config('role', 'postgres', true);

  perform pg_temp.as_user(victoria);
  insert into t_results values ('the job''s Recruiter can''t set up approval reminders',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, %L, null, 'offer.approval_waiting', '{"every_days": 1}', %L, 'x')$q$, ten, sdr, approver)) = 'GSL02');
  card_auto := public.slack_save_automation(null, ten, sdr, null, 'scorecard.due', '{"every_days": 1}', interviewer,
    'Hi {interviewer}! Your scorecard for {candidate} ({stage}) is due. {scorecard_link}');
  insert into t_results values ('the job''s Recruiter sets up scorecard reminders for their job', card_auto is not null);
  insert into t_results values ('a scorecard reminder may go only once (no every_days)',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, %L, null, 'scorecard.due', '{}', %L, 'x')$q$, ten, sdr, interviewer)) = 'none');
  insert into t_results values ('scorecard reminders go only to the interviewer',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, %L, null, 'scorecard.due', '{"every_days": 1}', %L, 'x')$q$, ten, sdr, chan)) = 'GSL04');
  perform set_config('role', 'postgres', true);
  -- Only the one just made counts below.
  update public.slack_automations set is_active = false
  where tenant_id = ten and event = 'scorecard.due' and id <> card_auto;

  -- An offer waiting for approval: approver 1 (Erik) has had it 3 days.
  select a.id, a.candidate_id into assoc, cand
  from public.job_candidate_associations a where a.job_id = sdr and a.status = 'active' limit 1;
  insert into public.offer_letters (candidate_id, job_id, organization_id, title, status, created_by)
  values (cand, sdr, ten, 'Slack reminder test offer', 'pending_approval', victoria)
  returning id into ol;
  insert into public.offer_approval_requests (offer_letter_id, job_id, organization_id, candidate_id, requested_by, status,
    current_step_order, created_at)
  values (ol, sdr, ten, cand, victoria, 'pending', 1, now() - interval '3 days')
  returning id into req;
  insert into public.offer_approval_request_steps (request_id, approver_user_id, step_order, status)
  values (req, erik, 1, 'pending'), (req, jurre, 2, 'pending');
  select id into s1 from public.offer_approval_request_steps where request_id = req and step_order = 1;
  select id into s2 from public.offer_approval_request_steps where request_id = req and step_order = 2;

  perform public.slack_due_reminders();
  select count(*) into n from public.slack_deliveries where automation_id = wait_auto and context ->> 'turn_step_id' = s1::text;
  insert into t_results values ('approver 1 is reminded once (their turn began 3 days ago)', n = 1);
  select count(*) into n from public.slack_deliveries where automation_id = wait_auto and context ->> 'turn_step_id' = s2::text;
  insert into t_results values ('approver 2 isn''t reminded before their turn', n = 0);
  perform public.slack_due_reminders();
  select count(*) into n from public.slack_deliveries where automation_id = wait_auto and context ->> 'turn_step_id' = s1::text;
  insert into t_results values ('a second run the same day sends nothing more', n = 1);

  mc := public.slack_message_context(jsonb_build_object('request_id', req, 'turn_step_id', s1, 'job_id', sdr,
    'candidate_id', cand, 'actor_id', victoria));
  insert into t_results values ('the reminder names whose turn it is and how long it has waited (' || coalesce(mc ->> 'waiting', 'none') || ')',
    jsonb_array_length(mc -> 'approvers') = 1 and (mc -> 'approvers' -> 0 ->> 'name') is not null
    and mc ->> 'waiting' = '3 days' and (mc ->> 'turn')::boolean);

  -- Remind sends at once.
  perform pg_temp.as_user(victoria);
  perform public.offer_approval_remind(req);
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.slack_deliveries
  where automation_id = wait_auto and event_key like 'approval_nudge:%' and context ->> 'turn_step_id' = s1::text;
  insert into t_results values ('Remind sends the approver a Slack reminder at once', n = 1);

  -- Erik approves: what was queued for him is skipped, never sent late.
  update public.offer_approval_request_steps set status = 'approved', decided_at = now() where id = s1;
  update public.offer_approval_requests set current_step_order = 2 where id = req;
  perform count(*) from (select public.slack_deliveries_claim(100)) x;
  select count(*) into n from public.slack_deliveries
  where automation_id = wait_auto and context ->> 'turn_step_id' = s1::text and status = 'skipped' and error = 'No longer their turn';
  insert into t_results values ('once approved, approver 1''s reminders are skipped', n = 2);
  perform public.slack_due_reminders();
  select count(*) into n from public.slack_deliveries where automation_id = wait_auto and context ->> 'turn_step_id' = s2::text;
  insert into t_results values ('approver 2''s turn just began: no reminder yet', n = 0);

  -- A scorecard: Jurre interviewed the candidate an hour ago at a stage that
  -- requires one.
  update public.job_hiring_stages set require_scorecard = true where id = hm_stage;
  update public.job_candidate_associations set current_stage_id = hm_stage, entered_stage_at = now() - interval '1 day' where id = assoc;
  insert into public.scheduled_bookings (booking_config_id, candidate_name, candidate_email, candidate_timezone,
    scheduled_start, scheduled_end, status, interviewer_id, candidate_id, job_id, job_candidate_association_id,
    job_hiring_stage_id, booked_by)
  values ((select id from public.booking_configurations limit 1), 'Test Candidate', 'test.candidate@example.com', 'UTC',
    now() - interval '2 hours', now() - interval '1 hour', 'confirmed', jurre, cand, sdr, assoc, hm_stage, victoria)
  returning id into bk;

  perform public.slack_due_reminders();
  select count(*) into n from public.slack_deliveries
  where automation_id = card_auto and context ->> 'association_id' = assoc::text and context ->> 'interviewer_user_id' = jurre::text;
  insert into t_results values ('the interviewer hears once the interview has ended', n = 1);
  perform public.slack_due_reminders();
  select count(*) into n from public.slack_deliveries
  where automation_id = card_auto and context ->> 'association_id' = assoc::text;
  insert into t_results values ('and not again before the next reminder is due', n = 1);
  mc := public.slack_message_context(jsonb_build_object('booking_id', bk, 'association_id', assoc, 'stage_id', hm_stage,
    'candidate_id', cand, 'job_id', sdr, 'interviewer_user_id', jurre));
  insert into t_results values ('the message names the interviewer and the stage',
    (mc -> 'interviewer' ->> 'name') is not null and mc ->> 'stage' is not null);

  -- A day later the reminder is due again.
  update public.slack_deliveries set created_at = now() - interval '25 hours'
  where automation_id = card_auto and context ->> 'association_id' = assoc::text;
  perform public.slack_due_reminders();
  select count(*) into n from public.slack_deliveries
  where automation_id = card_auto and context ->> 'association_id' = assoc::text;
  insert into t_results values ('every day until it''s in', n = 2);

  -- Request sends at once; not from someone outside the workspace.
  select public.slack_scorecard_requested(assoc, hm_stage, array[jurre], victoria) into n;
  insert into t_results values ('Request sends the interviewer a Slack reminder at once', n = 1);
  select public.slack_scorecard_requested(assoc, hm_stage, array[jurre], gen_random_uuid()) into n;
  insert into t_results values ('a request from outside the workspace sends nothing', n = 0);
  insert into t_results values ('only the server asks for it',
    not has_function_privilege('authenticated', 'public.slack_scorecard_requested(uuid, uuid, uuid[], uuid)', 'execute'));

  -- Jurre submits: nothing more goes out.
  insert into public.job_stage_scorecards (association_id, stage_instance_id, job_id, candidate_id, created_by, rating)
  values (assoc, hm_stage, sdr, cand, jurre, 'yes');
  perform count(*) from (select public.slack_deliveries_claim(100)) x;
  select count(*) into n from public.slack_deliveries
  where automation_id = card_auto and context ->> 'association_id' = assoc::text and status = 'skipped';
  insert into t_results values ('once submitted, what was queued is skipped', n >= 1);
  update public.slack_deliveries set created_at = now() - interval '3 days'
  where automation_id = card_auto and context ->> 'association_id' = assoc::text;
  perform public.slack_due_reminders();
  select count(*) into n from public.slack_deliveries
  where automation_id = card_auto and context ->> 'association_id' = assoc::text and status = 'queued';
  insert into t_results values ('and no new reminder is queued', n = 0);

  insert into t_results values ('the run is the server''s only',
    not has_function_privilege('authenticated', 'public.slack_due_reminders()', 'execute'));
  insert into t_results values ('it runs every 15 minutes',
    exists (select 1 from cron.job where jobname = 'slack-due-reminders' and schedule = '*/15 * * * *'));
end $$;

select * from t_results order by ok, check_name;
