-- Run after 20261028200000_slack_log inside a transaction that is rolled back.
-- Slack log: each automation's History, a line in the candidate's activity for
-- every message about them that went out or failed (offer ones only for the
-- offer team), Send now for reminders (who's waiting, then all at once, at
-- most every 10 minutes, counted by the schedule) and Send again for a message
-- that didn't go out.
-- Job: Sales Development Representative (SDR), with a fake offer, approval
-- chain and interview; one of its stages is made to require a scorecard.
--   Allan Bravo     admin           approval reminders, profile reminders
--   Victoria Bravo  Recruiter       the job's scorecard reminders
--   Erik Veen       approver 1      Jurre Veen  the interviewer
--   a teammate who can open the candidate but has no seat on the job
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
  outsider constant uuid := '4110ac77-f873-46f7-9bf2-c5774bfab028';
  approver constant jsonb := '[{"type":"role","role":"approver"}]';
  interviewer constant jsonb := '[{"type":"role","role":"interviewer"}]';
  chan constant jsonb := '[{"type":"channel","id":"C0HIRING01","name":"hiring"}]';
  wait_auto uuid;
  card_auto uuid;
  hire_auto uuid;
  prof_auto uuid;
  assoc uuid;
  cand uuid;
  ol uuid;
  req uuid;
  s1 uuid;
  dl uuid;
  card_dl uuid;
  n int;
  n0 int;
  r jsonb;
  h jsonb;
  act record;
begin
  perform public.slack_connection_save(ten, allan,
    '{"team_id":"T0TEST0001","team_name":"Virgilio","bot_user_id":"U0GIOBOT01","scopes":["chat:write"]}', 'xoxb-stand-in');

  perform pg_temp.as_user(allan);
  wait_auto := public.slack_save_automation(null, ten, null, null, 'offer.approval_waiting', '{"every_days": 2}', approver,
    'Hi {approver}! The offer for {candidate} has waited {waiting}. {offer_link}');
  hire_auto := public.slack_save_automation(null, ten, null, null, 'candidate.hired', '{}', chan, '{candidate} was hired');
  prof_auto := public.slack_save_automation(null, ten, null, null, 'member.profile_incomplete', '{"every_days": 7}',
    '[{"type":"role","role":"member"}]', 'Hi {member}, your profile is {progress}.');
  perform set_config('role', 'postgres', true);
  perform pg_temp.as_user(victoria);
  card_auto := public.slack_save_automation(null, ten, sdr, null, 'scorecard.due', '{"every_days": 1}', interviewer,
    'Hi {interviewer}! Your scorecard for {candidate} is due. {scorecard_link}');
  perform set_config('role', 'postgres', true);
  -- Only the ones made here count below.
  update public.slack_automations set is_active = false
  where tenant_id = ten and event in ('scorecard.due', 'offer.approval_waiting', 'member.profile_incomplete')
    and id not in (wait_auto, card_auto, prof_auto);

  -- An offer waiting for approval: Erik has had it 3 days.
  select a.id, a.candidate_id into assoc, cand
  from public.job_candidate_associations a where a.job_id = sdr and a.status = 'active' limit 1;
  insert into public.offer_letters (candidate_id, job_id, organization_id, title, status, created_by)
  values (cand, sdr, ten, 'Slack log test offer', 'pending_approval', victoria)
  returning id into ol;
  insert into public.offer_approval_requests (offer_letter_id, job_id, organization_id, candidate_id, requested_by, status,
    current_step_order, created_at)
  values (ol, sdr, ten, cand, victoria, 'pending', 1, now() - interval '3 days')
  returning id into req;
  insert into public.offer_approval_request_steps (request_id, approver_user_id, step_order, status)
  values (req, erik, 1, 'pending'), (req, jurre, 2, 'pending');
  select id into s1 from public.offer_approval_request_steps where request_id = req and step_order = 1;

  -- Send now: who's waiting, then all at once.
  perform pg_temp.as_user(allan);
  -- Real offers may be waiting too; this one waited 3 days.
  r := public.slack_send_now(wait_auto, true);
  n0 := (r ->> 'count')::int;
  insert into t_results values ('Send now lists who''s waiting (' || n0 || ')',
    exists (select 1 from jsonb_array_elements(r -> 'waiting') x
            where x ->> 'waiting' = '3 days' and x ->> 'to' is not null and x ->> 'candidate' is not null)
    and not exists (select 1 from jsonb_array_elements(r -> 'waiting') x where x ->> 'to' is null));
  select count(*) into n from public.slack_deliveries where automation_id = wait_auto;
  insert into t_results values ('the list sends nothing', n = 0);
  insert into t_results values ('Send now is only for reminders',
    pg_temp.err_of(format('select public.slack_send_now(%L, false)', hire_auto)) = 'GSL04');
  r := public.slack_send_now(wait_auto, false);
  insert into t_results values ('Send now sends to everyone waiting', (r ->> 'queued')::int = n0);
  insert into t_results values ('and not twice in 10 minutes',
    pg_temp.err_of(format('select public.slack_send_now(%L, false)', wait_auto)) = 'GSL05');
  r := public.slack_send_now(wait_auto, true);
  insert into t_results values ('the list says when it can go again', r ->> 'next_at' is not null);
  r := public.slack_send_now(prof_auto, true);
  insert into t_results values ('profile reminders list the people still missing something (' || (r ->> 'count') || ')',
    (r ->> 'count')::int >= 1 and not exists (select 1 from jsonb_array_elements(r -> 'waiting') x where x ->> 'to' is null));
  perform set_config('role', 'postgres', true);
  perform pg_temp.as_user(victoria);
  insert into t_results values ('a Recruiter can''t send a workspace reminder',
    pg_temp.err_of(format('select public.slack_send_now(%L, true)', wait_auto)) = 'GSL01');
  perform set_config('role', 'postgres', true);

  select id into dl from public.slack_deliveries
  where automation_id = wait_auto and event_key like 'send_now:%' and context ->> 'turn_step_id' = s1::text;
  insert into t_results values ('the manual one carries who pressed it',
    (select context ->> 'sent_by' = allan::text and context ->> 'turn_step_id' = s1::text from public.slack_deliveries where id = dl));
  perform public.slack_due_reminders();
  select count(*) into n from public.slack_deliveries where automation_id = wait_auto and event_key like 'approval_waiting:%';
  insert into t_results values ('the schedule counts from the manual send (no second one today)', n = 0);

  -- It went out: one line in the candidate's activity.
  perform public.slack_delivery_finish(dl, true, null, '[{"to":"Erik Veen","ok":true,"ts":"1.2"}]'::jsonb);
  select * into act from public.activities
  where metadata ->> 'source' = 'slack' and metadata -> 'slack' ->> 'delivery_id' = dl::text;
  insert into t_results values ('a sent message writes one activity line',
    (select count(*) = 1 from public.activities where metadata ->> 'source' = 'slack' and metadata -> 'slack' ->> 'delivery_id' = dl::text));
  insert into t_results values ('the line says who it reached, in the job, by who pressed it (' || coalesce(act.description, '?') || ')',
    act.activity_type::text = 'automation_triggered' and act.entity_id = cand and act.description = 'To Erik Veen'
    and act.metadata ->> 'job_id' = sdr::text and act.user_id = allan and act.metadata -> 'slack' ->> 'trigger' = 'send_now'
    and act.metadata ->> 'slack_event' = 'offer.approval_waiting');

  -- The offer team sees it; an interviewer doesn't.
  perform pg_temp.as_user(allan);
  select count(*) into n from public.get_candidate_activities(cand, sdr) g where g.metadata -> 'slack' ->> 'delivery_id' = dl::text;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('an admin sees the offer reminder line', n = 1);
  perform pg_temp.as_user(outsider);
  select count(*) into n from public.get_candidate_activities(cand, sdr) g where g.metadata -> 'slack' ->> 'delivery_id' = dl::text;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('someone outside the offer team doesn''t see Slack lines about offers', n = 0);

  -- History.
  perform pg_temp.as_user(allan);
  h := public.slack_automation_history(wait_auto, 50);
  perform set_config('role', 'postgres', true);
  insert into t_results values ('History shows the message, what started it, who and who it reached',
    jsonb_array_length(h -> 'rows') = n0 and exists (
      select 1 from jsonb_array_elements(h -> 'rows') x
      where x ->> 'id' = dl::text and x ->> 'trigger' = 'send_now' and x ->> 'status' = 'sent' and x ->> 'by' is not null
        and x -> 'recipients' -> 0 ->> 'to' = 'Erik Veen' and x ->> 'candidate' is not null and not x ? 'message'));
  perform pg_temp.as_user(victoria);
  insert into t_results values ('a Recruiter can''t read an offer automation''s History',
    pg_temp.err_of(format('select public.slack_automation_history(%L)', wait_auto)) = 'GSL01');
  perform set_config('role', 'postgres', true);

  -- A scorecard reminder that didn't go out.
  update public.job_hiring_stages set require_scorecard = true where id = hm_stage;
  update public.job_candidate_associations set current_stage_id = hm_stage, entered_stage_at = now() - interval '1 day' where id = assoc;
  insert into public.scheduled_bookings (booking_config_id, candidate_name, candidate_email, candidate_timezone,
    scheduled_start, scheduled_end, status, interviewer_id, candidate_id, job_id, job_candidate_association_id,
    job_hiring_stage_id, booked_by)
  values ((select id from public.booking_configurations limit 1), 'Test Candidate', 'test.candidate@example.com', 'UTC',
    now() - interval '2 hours', now() - interval '1 hour', 'confirmed', jurre, cand, sdr, assoc, hm_stage, victoria);
  perform public.slack_due_reminders();
  select id into card_dl from public.slack_deliveries
  where automation_id = card_auto and context ->> 'association_id' = assoc::text and event_key like 'scorecard_due:%:first';
  insert into t_results values ('the schedule still queues the first scorecard reminder', card_dl is not null);
  perform public.slack_delivery_finish(card_dl, false, 'Nothing went out.',
    '[{"to":"Jurre Veen","ok":false,"error":"no_slack_account","problem":"Jurre Veen isn''t in your Slack under jurre@example.com."}]'::jsonb, false);
  select * into act from public.activities
  where metadata ->> 'source' = 'slack' and metadata -> 'slack' ->> 'delivery_id' = card_dl::text;
  insert into t_results values ('a message that didn''t go out writes a line with the reason, by Gio',
    act.activity_type::text = 'automation_skipped' and act.title = 'Slack message didn''t go out'
    and act.description like 'Jurre Veen isn''t in your Slack%' and act.metadata ->> 'external_actor' = 'gio');
  perform pg_temp.as_user(outsider);
  select count(*) into n from public.get_candidate_activities(cand, sdr) g where g.metadata -> 'slack' ->> 'delivery_id' = card_dl::text;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('lines that aren''t about offers show for everyone who sees the candidate', n = 1);

  perform pg_temp.as_user(victoria);
  h := public.slack_automation_history(card_auto, 50);
  insert into t_results values ('the job''s Recruiter sees their automation''s History, with Send again',
    h -> 'rows' -> 0 ->> 'status' = 'failed' and (h -> 'rows' -> 0 ->> 'can_retry')::boolean
    and h -> 'rows' -> 0 ->> 'trigger' = 'schedule' and h -> 'rows' -> 0 -> 'recipients' -> 0 ->> 'problem' is not null);
  perform set_config('role', 'postgres', true);

  -- Send again.
  perform pg_temp.as_user(jurre);
  insert into t_results values ('an interviewer can''t send it again',
    pg_temp.err_of(format('select public.slack_retry_delivery(%L)', card_dl)) = 'GSL01');
  perform set_config('role', 'postgres', true);
  perform pg_temp.as_user(victoria);
  perform public.slack_retry_delivery(card_dl);
  perform set_config('role', 'postgres', true);
  insert into t_results values ('Send again puts it back in the queue',
    (select status = 'queued' and attempts = 0 and error is null and context ->> 'resent_by' = victoria::text
     from public.slack_deliveries where id = card_dl));
  perform pg_temp.as_user(allan);
  insert into t_results values ('only a message that didn''t go out can be sent again',
    pg_temp.err_of(format('select public.slack_retry_delivery(%L)', dl)) = 'GSL04');
  perform set_config('role', 'postgres', true);

  -- Skipped messages stay out of the feed.
  select count(*) into n0 from public.activities where metadata ->> 'source' = 'slack';
  update public.slack_deliveries set status = 'skipped', error = 'Scorecard no longer due' where id = card_dl;
  select count(*) into n from public.activities where metadata ->> 'source' = 'slack';
  insert into t_results values ('a skipped message writes no line', n = n0);

  insert into t_results values ('who''s waiting and the schedule are the server''s only',
    not has_function_privilege('authenticated', 'public.slack_reminders_waiting(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.slack_queue_due(text[])', 'execute')
    and not has_function_privilege('authenticated', 'public.slack_kick()', 'execute'));
  insert into t_results values ('signed-out people can''t use any of it',
    not has_function_privilege('anon', 'public.slack_send_now(uuid, boolean)', 'execute')
    and not has_function_privilege('anon', 'public.slack_automation_history(uuid, integer)', 'execute')
    and not has_function_privilege('anon', 'public.slack_retry_delivery(uuid)', 'execute'));
end $$;

do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n' order by ok, check_name) into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
