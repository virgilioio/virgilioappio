-- Run after 20261028220000_slack_google_broken inside a transaction that is rolled back.
-- "Someone's Google stops working": a DM to the person when their Gmail or
-- Calendar goes from working to needing a reconnect, once a day, only to
-- them, skipped if they reconnected before it went out.
--   Allan Bravo     admin, sets it up
--   Victoria Bravo  her Google breaks (connected and healthy on live data)
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
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  victoria constant uuid := '61148617-e4e6-4d72-9176-67b203e98aae';
  member_dm constant jsonb := '[{"type":"role","role":"member"}]';
  chan constant jsonb := '[{"type":"channel","id":"C0HIRING01","name":"hiring"}]';
  alert uuid;
  vic_member uuid;
  n int;
  mc jsonb;
begin
  perform public.slack_connection_save(ten, allan,
    '{"team_id":"T0TEST0001","team_name":"Virgilio","bot_user_id":"U0GIOBOT01","scopes":["chat:write"]}', 'xoxb-stand-in');
  select id into vic_member from public.members where tenant_id = ten and user_id = victoria;

  perform pg_temp.as_user(allan);
  alert := public.slack_save_automation(null, ten, null, null, 'member.google_broken', '{}', member_dm,
    'Hi {member}! Your Google Workspace stopped working in Gio. {my_profile_link}');
  insert into t_results values ('an admin sets up the Google alert', alert is not null);
  insert into t_results values ('it goes only to the person',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'member.google_broken', '{}', %L, 'x')$q$, ten, chan)) = 'GSL04');
  insert into t_results values ('it never repeats',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'member.google_broken', '{"every_days": 7}', %L, 'x')$q$, ten, member_dm)) = 'GSL04');
  perform set_config('role', 'postgres', true);
  perform pg_temp.as_user(victoria);
  insert into t_results values ('a Recruiter can''t set it up',
    pg_temp.err_of(format($q$select public.slack_save_automation(null, %L, null, null, 'member.google_broken', '{}', %L, 'x')$q$, ten, member_dm)) = 'GSL01');
  perform set_config('role', 'postgres', true);

  -- A healthy update says nothing.
  update public.user_mail_identities set last_sync_at = now(), sync_status = 'active' where user_id = victoria;
  select count(*) into n from public.slack_deliveries where automation_id = alert;
  insert into t_results values ('nothing while Google works', n = 0);

  -- Her Gmail expires: one DM.
  update public.user_mail_identities set sync_status = 'expired', sync_error = 'Google access was revoked or expired.'
  where user_id = victoria;
  select count(*) into n from public.slack_deliveries
  where automation_id = alert and context ->> 'member_id' = vic_member::text
    and event_key = 'google_broken:' || vic_member || ':' || (now() at time zone 'America/Mexico_City')::date;
  insert into t_results values ('Gmail breaking DMs her at once', n = 1);
  mc := public.slack_message_context((select context from public.slack_deliveries where automation_id = alert limit 1));
  insert into t_results values ('the message is about her and Google is what''s missing',
    mc -> 'member' ->> 'id' = victoria::text and mc -> 'missing' ? 'google');

  -- Calendar breaks too, and the sync writes the same state again: still one.
  update public.calendar_identities set sync_status = 'expired' where user_id = victoria;
  update public.user_mail_identities set sync_status = 'expired' where user_id = victoria;
  select count(*) into n from public.slack_deliveries where automation_id = alert;
  insert into t_results values ('Gmail and Calendar together send one, never twice', n = 1);

  -- She reconnects before it goes out: skipped.
  update public.user_mail_identities set sync_status = 'active', sync_error = null where user_id = victoria;
  update public.calendar_identities set sync_status = 'healthy' where user_id = victoria;
  perform public.slack_deliveries_claim(50);
  insert into t_results values ('reconnecting before it went out skips it',
    (select status = 'skipped' and error = 'Google works again' from public.slack_deliveries where automation_id = alert));

  -- It breaks again the same day: the day's alert already went.
  update public.user_mail_identities set is_active = false where user_id = victoria;
  select count(*) into n from public.slack_deliveries where automation_id = alert;
  insert into t_results values ('at most once a day', n = 1);

  -- Turned off: nothing.
  update public.user_mail_identities set is_active = true where user_id = victoria;
  update public.slack_automations set is_active = false where id = alert;
  update public.slack_deliveries set event_key = event_key || ':earlier' where automation_id = alert;
  update public.user_mail_identities set sync_status = 'expired' where user_id = victoria;
  select count(*) into n from public.slack_deliveries where automation_id = alert;
  insert into t_results values ('a turned-off alert sends nothing', n = 1);

  insert into t_results values ('job pages don''t list it',
    not exists (select 1 from public.slack_automations a where a.id = alert and a.job_id is not null));
  insert into t_results values ('the trigger is the server''s',
    not has_function_privilege('authenticated', 'public.google_identities_z_slack()', 'execute'));
end $$;

do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n' order by ok, check_name) into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
