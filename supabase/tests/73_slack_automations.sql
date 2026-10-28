-- Run after 20261028022907_slack_people (and 20261028130000_slack_event_rule) inside a transaction that is rolled back.
-- Slack: who sets up automations, which events queue a message (once), that
-- the token and the queue stay server-side, that the offer approver hears
-- only when it's their turn, and People: a welcome once when someone joins,
-- profile reminders until complete, internal members only.
-- Jobs: Sales Development Representative (SDR) and the open job where
-- Melissa Perez is Recruiter (OTHER).
--   Allan Bravo     admin                       workspace-wide and offer automations
--   Victoria Bravo  Recruiter on SDR            SDR's own automations, no offers
--   Erik Veen       Hiring manager on SDR       none
--   Jurre Veen      Interviewer on SDR          none (reads the status)
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
  other constant uuid := 'afd14389-9945-4b33-b81a-65104e0335a8';
  victoria constant uuid := '61148617-e4e6-4d72-9176-67b203e98aae';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  erik constant uuid := '71fb2937-3df8-4dfa-b065-aaaa5ee64af8';
  jurre constant uuid := '7e274af6-466f-41b1-91a5-04b479e6c2ed';
  chan constant jsonb := '[{"type":"channel","id":"C0HIRING01","name":"hiring"}]';
  hire_auto uuid;
  stage_auto uuid;
  other_auto uuid;
  a_sdr uuid;
  a_other uuid;
  next_stage uuid;
  next_other uuid;
  n int;
  claimed jsonb;
  st jsonb;
  e text;
  appr_auto uuid;
  appr_only uuid;
  ol uuid;
  req uuid;
  s1 uuid;
  s2 uuid;
  s3 uuid;
  mc jsonb;
  n0 int;
  welcome uuid;
  remind uuid;
  vic_member uuid;
  allan_member uuid;
  ext_member uuid;
begin
  -- Slack connected (a stand-in token, rolled back with everything else).
  perform public.slack_connection_save(ten, allan,
    '{"team_id":"T0TEST0001","team_name":"Virgilio","bot_user_id":"U0GIOBOT01","scopes":["chat:write"]}', 'xoxb-stand-in');

  -- What the job's Recruiter already sees (real automations stay as they are).
  perform pg_temp.as_user(victoria);
  select count(*) into n0 from public.slack_automations_list(ten, sdr);
  perform set_config('role', 'postgres', true);

  -- Who may set up what.
  perform pg_temp.as_user(allan);
  hire_auto := public.slack_save_automation(null, ten, null, 'Hires', 'candidate.hired', '{}', chan,
    '{who} just hired {candidate} for {client}');
  other_auto := public.slack_save_automation(null, ten, null, null, 'candidate.stage_changed',
    jsonb_build_object('job_ids', jsonb_build_array(other)), chan, '{candidate} moved to {stage}');
  e := pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, %L, null, 'offer.signed', '{}', %L, '{candidate} signed')$q$, ten, sdr, chan));
  perform set_config('role', 'postgres', true);
  insert into t_results values ('an admin adds a workspace-wide automation', hire_auto is not null);
  insert into t_results values ('an admin adds an offer automation on a job', e = 'none');

  perform pg_temp.as_user(victoria);
  insert into t_results values ('the job''s Recruiter can''t add a workspace-wide one',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'candidate.hired', '{}', %L, 'x')$q$, ten, chan)) = 'GSL01');
  stage_auto := public.slack_save_automation(null, ten, sdr, null, 'candidate.stage_changed', '{}',
    '[{"type":"role","role":"hiring_manager"},{"type":"user","id":"U0ALLAN001","name":"Allan"}]', '{candidate} is now in {stage} <@U0ALLAN001>');
  insert into t_results values ('the job''s Recruiter adds one for their job', stage_auto is not null);
  insert into t_results values ('the job''s Recruiter can''t add one for another job',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, %L, null, 'candidate.hired', '{}', %L, 'x')$q$, ten, other, chan)) = 'GSL01');
  insert into t_results values ('the job''s Recruiter can''t send offer events',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, %L, null, 'offer.signed', '{}', %L, 'x')$q$, ten, sdr, chan)) = 'GSL02');
  insert into t_results values ('the job''s Recruiter can''t change the workspace-wide one',
    pg_temp.err_of(format($q$select public.slack_set_automation(%L, false)$q$, hire_auto)) = 'GSL01');
  insert into t_results values ('a message can''t ask for pay',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, %L, null, 'candidate.hired', '{}', %L, 'Offer {salary}')$q$, ten, sdr, chan)) = 'GSL04');
  insert into t_results values ('somewhere to send it is required and checked',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, %L, null, 'candidate.hired', '{}', '[{"type":"channel","id":"#hiring"}]', 'x')$q$, ten, sdr)) = 'GSL04');
  select count(*) into n from public.slack_automations_list(ten, sdr);
  insert into t_results values ('the job''s Recruiter sees its own and the workspace-wide ones that apply (' || (n - n0) || ' new)', n = n0 + 3);
  perform set_config('role', 'postgres', true);

  perform pg_temp.as_user(erik);
  insert into t_results values ('the Hiring manager can''t add one',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, %L, null, 'candidate.hired', '{}', %L, 'x')$q$, ten, sdr, chan)) = 'GSL01');
  perform set_config('role', 'postgres', true);

  perform pg_temp.as_user(jurre);
  st := public.slack_status(ten);
  select count(*) into n from public.slack_connections;
  insert into t_results values ('an interviewer reads the status, connected, not admin',
    (st ->> 'connected')::boolean and not (st ->> 'is_admin')::boolean and st ->> 'team_name' = 'Virgilio' and not st ? 'token');
  insert into t_results values ('nobody reads the connection table', n = 0);
  select count(*) into n from public.slack_deliveries;
  insert into t_results values ('nobody reads the queue', n = 0);
  perform set_config('role', 'postgres', true);

  -- Events. A candidate on SDR moves a stage and is hired; one on OTHER moves.
  select a.id, (select h.id from public.job_hiring_stages h where h.job_id = a.job_id and h.id is distinct from a.current_stage_id order by h.position limit 1)
    into a_sdr, next_stage
  from public.job_candidate_associations a where a.job_id = sdr and a.status = 'active' limit 1;
  select a.id, (select h.id from public.job_hiring_stages h where h.job_id = a.job_id and h.id is distinct from a.current_stage_id order by h.position limit 1)
    into a_other, next_other
  from public.job_candidate_associations a where a.job_id = other and a.status = 'active' limit 1;

  perform pg_temp.as_user(allan);
  update public.job_candidate_associations set current_stage_id = next_stage, entered_stage_at = now() where id = a_sdr;
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.slack_deliveries where automation_id = stage_auto and context ->> 'association_id' = a_sdr::text;
  insert into t_results values ('a stage move queues the job''s automation once', n = 1);
  select count(*) into n from public.slack_deliveries where automation_id = other_auto;
  insert into t_results values ('a filter for another job doesn''t fire', n = 0);

  update public.job_candidate_associations set status = 'hired', hired_at = now(), hired_by = allan where id = a_sdr;
  update public.job_candidate_associations set notes = coalesce(notes, '') where id = a_sdr;
  select count(*) into n from public.slack_deliveries where automation_id = hire_auto;
  insert into t_results values ('a hire queues one message, never twice', n = 1);

  if a_other is not null then
    update public.job_candidate_associations set current_stage_id = next_other, entered_stage_at = now() where id = a_other;
    select count(*) into n from public.slack_deliveries where automation_id = other_auto;
    insert into t_results values ('the filtered one fires for its job', n = 1);
    select count(*) into n from public.slack_deliveries where automation_id = stage_auto and context ->> 'association_id' = a_other::text;
    insert into t_results values ('a job''s automation doesn''t fire for another job', n = 0);
  end if;

  -- The worker gets the token and names, never pay.
  claimed := public.slack_deliveries_claim(50);
  insert into t_results values ('the worker claims what''s due (' || jsonb_array_length(claimed) || ')', jsonb_array_length(claimed) >= 2);
  insert into t_results values ('the worker gets the token decrypted',
    (select bool_and(x -> 'connection' ->> 'token' = 'xoxb-stand-in') from jsonb_array_elements(claimed) x));
  insert into t_results values ('the message context has the candidate and job',
    (select bool_and(x -> 'context' -> 'candidate' ->> 'name' is not null and x -> 'context' -> 'job' ->> 'title' is not null)
     from jsonb_array_elements(claimed) x));
  insert into t_results values ('the hire names who did it',
    (select bool_and(x -> 'context' -> 'actor' ->> 'id' = allan::text) from jsonb_array_elements(claimed) x where x ->> 'event' = 'candidate.hired'));
  insert into t_results values ('no pay in the context',
    not exists (select 1 from jsonb_array_elements(claimed) x where (x -> 'context')::text ~* 'salary|compensation|"amount"'));
  insert into t_results values ('a claimed message isn''t handed out again', jsonb_array_length(public.slack_deliveries_claim(50)) = 0);

  -- Finishing: sent, retry, failed.
  perform public.slack_delivery_finish((claimed -> 0 ->> 'id')::uuid, true);
  insert into t_results values ('a sent message marks the automation',
    (select last_sent_at is not null from public.slack_automations where id = (claimed -> 0 -> 'automation' ->> 'id')::uuid));
  perform public.slack_delivery_finish((claimed -> 1 ->> 'id')::uuid, false, 'ratelimited', null, true);
  insert into t_results values ('a failed send waits and retries',
    (select status = 'queued' and next_attempt_at > now() from public.slack_deliveries where id = (claimed -> 1 ->> 'id')::uuid));

  -- Remove (Undo restores); removed ones don't fire.
  perform pg_temp.as_user(victoria);
  perform public.slack_set_automation(stage_auto, null, true);
  perform set_config('role', 'postgres', true);
  update public.job_candidate_associations set status = 'active', current_stage_id = next_stage where id = a_sdr;
  update public.job_candidate_associations set current_stage_id = (select h.id from public.job_hiring_stages h where h.job_id = sdr and h.id <> next_stage order by h.position desc limit 1), entered_stage_at = now() + interval '1 second' where id = a_sdr;
  select count(*) into n from public.slack_deliveries where automation_id = stage_auto;
  insert into t_results values ('a removed automation doesn''t fire', n = 1);
  perform pg_temp.as_user(victoria);
  perform public.slack_set_automation(stage_auto, null, false);
  perform set_config('role', 'postgres', true);
  insert into t_results values ('Undo restores it', (select removed_at is null from public.slack_automations where id = stage_auto));

  -- The offer approver: one at a time, only on their turn.
  perform pg_temp.as_user(allan);
  appr_auto := public.slack_save_automation(null, ten, null, null, 'offer.approval_requested', '{}',
    chan || '[{"type":"role","role":"approver"}]'::jsonb, '{approver}, your turn ({approval_step})');
  appr_only := public.slack_save_automation(null, ten, null, null, 'offer.approval_requested', '{}',
    '[{"type":"role","role":"approver"}]', '{approver}, the offer for {candidate} is yours to approve');
  insert into t_results values ('the offer approver is only for "An offer needs approval"',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'offer.approved', '{}', '[{"type":"role","role":"approver"}]', 'x')$q$, ten)) = 'GSL04');
  perform set_config('role', 'postgres', true);

  insert into public.offer_letters (candidate_id, job_id, organization_id, title, status, created_by)
  values ((select candidate_id from public.job_candidate_associations where id = a_sdr), sdr, ten, 'Slack test offer', 'pending_approval', victoria)
  returning id into ol;
  insert into public.offer_approval_requests (offer_letter_id, job_id, organization_id, candidate_id, requested_by, status, current_step_order)
  values (ol, sdr, ten, (select candidate_id from public.offer_letters where id = ol), victoria, 'pending', 1)
  returning id into req;
  insert into public.offer_approval_request_steps (request_id, approver_user_id, step_order, status)
  values (req, allan, 1, 'pending'), (req, erik, 2, 'pending'), (req, jurre, 3, 'pending');
  select id into s1 from public.offer_approval_request_steps where request_id = req and step_order = 1;
  select id into s2 from public.offer_approval_request_steps where request_id = req and step_order = 2;
  select id into s3 from public.offer_approval_request_steps where request_id = req and step_order = 3;

  select count(*) into n from public.slack_deliveries where event_key = 'approval_requested:' || req;
  insert into t_results values ('the channel hears once per request, the approver-only automation doesn''t (' || n || ')',
    n = 1 and exists (select 1 from public.slack_deliveries where event_key = 'approval_requested:' || req and automation_id = appr_auto));
  -- Counts only this test's automations (real ones may also be listening).
  select count(*) into n from public.slack_deliveries where context ? 'turn_step_id' and context ->> 'request_id' = req::text
    and automation_id in (appr_auto, appr_only);
  insert into t_results values ('only approver 1 has a turn when it goes out (' || n || ')',
    n = 2 and not exists (select 1 from public.slack_deliveries where context ->> 'request_id' = req::text
      and context ? 'turn_step_id' and context ->> 'turn_step_id' <> s1::text));
  mc := public.slack_message_context((select context from public.slack_deliveries where event_key = 'approval_turn:' || s1 limit 1));
  insert into t_results values ('the turn names approver 1 and "Step 1 of 3"',
    (mc ->> 'turn')::boolean and jsonb_array_length(mc -> 'approvers') = 1
    and mc -> 'approvers' -> 0 ->> 'id' = allan::text and mc ->> 'approval_step' = 'Step 1 of 3');
  mc := public.slack_message_context((select context from public.slack_deliveries where event_key = 'approval_requested:' || req));
  insert into t_results values ('the request''s message names whose turn it is', mc -> 'approvers' -> 0 ->> 'id' = allan::text and not (mc ->> 'turn')::boolean);

  perform pg_temp.as_user(allan);
  perform public.offer_approval_decide(s1, 'approved');
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.slack_deliveries where event_key = 'approval_turn:' || s2 and automation_id in (appr_auto, appr_only);
  insert into t_results values ('approving moves the turn to approver 2 (' || n || ')',
    n = 2 and not exists (select 1 from public.slack_deliveries where event_key = 'approval_turn:' || s3));
  perform public.offer_approval_slack_turns(req);
  select count(*) into n from public.slack_deliveries where event_key = 'approval_turn:' || s2 and automation_id in (appr_auto, appr_only);
  insert into t_results values ('an approver never hears twice for a step', n = 2);

  perform pg_temp.as_user(erik);
  perform public.offer_approval_decide(s2, 'declined');
  perform set_config('role', 'postgres', true);
  insert into t_results values ('a decline stops the chain',
    not exists (select 1 from public.slack_deliveries where event_key = 'approval_turn:' || s3));
  perform public.slack_deliveries_claim(50);
  select count(*) into n from public.slack_deliveries
  where context ->> 'request_id' = req::text and context ? 'turn_step_id' and status = 'skipped' and error = 'No longer their turn'
    and automation_id in (appr_auto, appr_only);
  insert into t_results values ('a turn that''s over is never sent late (' || n || ')', n = 4);

  -- People: a welcome once, profile reminders until complete, internal only.
  select id into vic_member from public.members where tenant_id = ten and user_id = victoria;
  select id into allan_member from public.members where tenant_id = ten and user_id = allan;
  select id into ext_member from public.members where tenant_id = ten and user_type::text = 'external' and user_status = 'active' limit 1;
  perform pg_temp.as_user(allan);
  welcome := public.slack_save_automation(null, ten, null, null, 'member.joined', '{}',
    chan || '[{"type":"role","role":"member"}]'::jsonb, 'Welcome to Gio, {member}!');
  remind := public.slack_save_automation(null, ten, null, null, 'member.profile_incomplete', '{"every_days": 7}',
    '[{"type":"role","role":"member"}]', 'Hi {member}, your profile is {progress}. Still to add: {missing}.');
  insert into t_results values ('an admin adds a welcome and a profile reminder', welcome is not null and remind is not null);
  insert into t_results values ('a profile reminder goes only to the team member',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'member.profile_incomplete', '{"every_days": 7}', %L, 'x')$q$, ten, chan)) = 'GSL04');
  insert into t_results values ('People automations are workspace-wide, never a job''s',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, %L, null, 'member.joined', '{}', '[{"type":"role","role":"member"}]', 'x')$q$, ten, sdr)) = 'GSL04');
  insert into t_results values ('the team member is only for People automations',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'candidate.hired', '{}', '[{"type":"role","role":"member"}]', 'x')$q$, ten)) = 'GSL04');
  insert into t_results values ('only profile reminders repeat, and they need how often',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'member.joined', '{"every_days": 7}', '[{"type":"role","role":"member"}]', 'x')$q$, ten)) = 'GSL04'
    and pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'member.profile_incomplete', '{}', '[{"type":"role","role":"member"}]', 'x')$q$, ten)) = 'GSL04'
    and pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'member.profile_incomplete', '{"every_days": 9}', '[{"type":"role","role":"member"}]', 'x')$q$, ten)) = 'GSL04');
  insert into t_results values ('People automations take no job filters',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'member.joined', %L, '[{"type":"role","role":"member"}]', 'x')$q$, ten, jsonb_build_object('job_ids', jsonb_build_array(sdr)))) = 'GSL04');
  select count(*) into n from public.slack_automations_list(ten, sdr) where event like 'member.%';
  insert into t_results values ('job pages don''t list People automations', n = 0);
  perform set_config('role', 'postgres', true);
  perform pg_temp.as_user(victoria);
  insert into t_results values ('a Recruiter can''t add a People automation',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'member.joined', '{}', '[{"type":"role","role":"member"}]', 'x')$q$, ten)) = 'GSL01');
  perform set_config('role', 'postgres', true);

  -- Victoria joins (again, in this transaction): one welcome, never twice.
  update public.members set user_status = 'inactive' where id = vic_member;
  update public.members set user_status = 'active' where id = vic_member;
  update public.members set user_status = 'inactive' where id = vic_member;
  update public.members set user_status = 'active' where id = vic_member;
  select count(*) into n from public.slack_deliveries where event_key = 'member_joined:' || vic_member;
  insert into t_results values ('joining queues the welcome once, never twice (' || n || ')',
    n = 1 and exists (select 1 from public.slack_deliveries where event_key = 'member_joined:' || vic_member and automation_id = welcome));
  if ext_member is not null then
    update public.members set user_status = 'inactive' where id = ext_member;
    update public.members set user_status = 'active' where id = ext_member;
    insert into t_results values ('an external user gets no welcome',
      not exists (select 1 from public.slack_deliveries where event_key = 'member_joined:' || ext_member));
  end if;
  mc := public.slack_message_context((select context from public.slack_deliveries where event_key = 'member_joined:' || vic_member));
  insert into t_results values ('the message names the member and what''s missing (' || (mc ->> 'progress') || ')',
    mc -> 'member' ->> 'id' = victoria::text and mc ->> 'progress' = '3 of 6 done'
    and mc -> 'missing' = '["you", "tax", "bank"]'::jsonb and mc ->> 'link' = '/me');

  -- Reminders: not on the day they join; due a week later; once a day at most.
  perform public.slack_profile_reminders();
  insert into t_results values ('no reminder the day someone joins',
    not exists (select 1 from public.slack_deliveries where automation_id = remind and context ->> 'member_id' = vic_member::text));
  update public.activities set created_at = now() - interval '8 days'
  where activity_type = 'member_activated' and metadata ->> 'member_id' = vic_member::text and created_at >= now() - interval '1 minute';
  perform public.slack_profile_reminders();
  perform public.slack_profile_reminders();
  select count(*) into n from public.slack_deliveries where automation_id = remind and context ->> 'member_id' = vic_member::text;
  insert into t_results values ('a week after joining the reminder is due, once (' || n || ')', n = 1);
  insert into t_results values ('a complete profile gets no reminder',
    not exists (select 1 from public.slack_deliveries where automation_id = remind and context ->> 'member_id' = allan_member::text));
  insert into t_results values ('external users get no reminders',
    not exists (select 1 from public.slack_deliveries d join public.members m on m.id::text = d.context ->> 'member_id'
                where d.automation_id = remind and m.user_type::text = 'external'));

  -- Never sent when it's no longer needed.
  insert into public.slack_deliveries (tenant_id, automation_id, event, event_key, context)
  values (ten, remind, 'member.profile_incomplete', 'profile_reminder:test:' || allan_member,
    jsonb_build_object('member_id', allan_member, 'member_user_id', allan));
  update public.members set user_status = 'inactive' where id = vic_member;
  perform public.slack_deliveries_claim(50);
  insert into t_results values ('someone who left gets no reminder',
    (select status = 'skipped' and error = 'No longer a team member' from public.slack_deliveries
     where automation_id = remind and context ->> 'member_id' = vic_member::text));
  insert into t_results values ('a profile completed meanwhile gets no reminder',
    (select status = 'skipped' and error = 'Profile complete' from public.slack_deliveries
     where event_key = 'profile_reminder:test:' || allan_member));
  update public.members set user_status = 'active' where id = vic_member;

  -- Disconnecting: waiting messages are skipped, nothing more queues.
  perform public.slack_connection_remove(ten, allan);
  perform public.slack_deliveries_claim(50);
  select count(*) into n from public.slack_deliveries where status in ('queued', 'sending');
  insert into t_results values ('disconnecting skips what was waiting', n = 0);
  perform pg_temp.as_user(allan);
  insert into t_results values ('no new automations without Slack',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'candidate.hired', '{}', %L, 'x')$q$, ten, chan)) = 'GSL03');
  perform set_config('role', 'postgres', true);

  insert into t_results values ('anon can''t read the status',
    not has_function_privilege('anon', 'public.slack_status(uuid)', 'execute'));
  insert into t_results values ('signed-in people can''t claim or read the token',
    not has_function_privilege('authenticated', 'public.slack_deliveries_claim(int)', 'execute')
    and not has_function_privilege('authenticated', 'public.slack_connection_token(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.slack_connection_save(uuid, uuid, jsonb, text)', 'execute'));
end $$;

-- Raise the results so the whole run rolls back, wherever it runs.
do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n') into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
