-- Run after 20261028000000_slack_automations inside a transaction that is rolled back.
-- Slack: who sets up automations, which events queue a message (once), and
-- that the token and the queue stay server-side.
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
begin
  -- Slack connected (a stand-in token, rolled back with everything else).
  perform public.slack_connection_save(ten, allan,
    '{"team_id":"T0TEST0001","team_name":"Virgilio","bot_user_id":"U0GIOBOT01","scopes":["chat:write"]}', 'xoxb-stand-in');

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
  insert into t_results values ('the job''s Recruiter sees its own and the workspace-wide ones that apply (' || n || ')', n = 3);
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
