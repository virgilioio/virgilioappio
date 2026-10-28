-- Run after 20261028182744_profile_google inside a transaction that is rolled back.
-- Google Workspace on My profile: a profile misses 'google' (right after
-- 'you') when the person has no Gmail or Calendar connection, or one that
-- needs reconnecting; a healthy one counts as done; a profile reminder's
-- progress counts seven things.
--   Allan Bravo     connected and healthy
--   Victoria Bravo  connected and healthy (the Slack test's member)
-- Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  victoria constant uuid := '61148617-e4e6-4d72-9176-67b203e98aae';
  nobody uuid;
  vic_member uuid;
  miss text[];
  mc jsonb;
begin
  insert into t_results values ('a healthy connection counts as done',
    not ('google' = any(public.os_profile_missing(ten, allan))));

  -- Someone in the workspace with no Google connection at all.
  select m.user_id into nobody
  from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.user_type::text <> 'external'
    and not exists (select 1 from public.user_mail_identities u where u.user_id = m.user_id)
    and not exists (select 1 from public.calendar_identities c where c.user_id = m.user_id)
  limit 1;
  insert into t_results values ('no connection means Google is still to do',
    nobody is not null and 'google' = any(public.os_profile_missing(ten, nobody)));

  -- Allan's Gmail expires: reconnecting is still to do.
  update public.user_mail_identities set sync_status = 'expired' where user_id = allan;
  insert into t_results values ('a connection that needs reconnecting is still to do',
    'google' = any(public.os_profile_missing(ten, allan)));
  update public.user_mail_identities set sync_status = 'active', sync_error = 'invalid_grant: Token has been revoked.' where user_id = allan;
  insert into t_results values ('so is one whose token was revoked',
    'google' = any(public.os_profile_missing(ten, allan)));
  update public.user_mail_identities set sync_status = 'active', sync_error = null where user_id = allan;
  update public.calendar_identities set is_active = false where user_id = allan;
  insert into t_results values ('and one that was turned off',
    'google' = any(public.os_profile_missing(ten, allan)));
  update public.calendar_identities set is_active = true where user_id = allan;

  -- The order: right after photo and title.
  update public.profiles set avatar_url = null where user_id = nobody;
  miss := public.os_profile_missing(ten, nobody);
  insert into t_results values ('Google comes right after photo and title (' || array_to_string(miss, ', ') || ')',
    miss[1] = 'you' and miss[2] = 'google');

  -- A profile reminder counts seven things.
  select id into vic_member from public.members where tenant_id = ten and user_id = victoria;
  miss := public.os_profile_missing(ten, victoria);
  mc := public.slack_message_context(jsonb_build_object('member_id', vic_member, 'member_user_id', victoria));
  insert into t_results values ('a reminder''s progress is out of seven (' || (mc ->> 'progress') || ')',
    mc ->> 'progress' = (7 - cardinality(miss)) || ' of 7 done' and mc -> 'missing' = to_jsonb(miss));
  insert into t_results values ('the check stays the server''s',
    not has_function_privilege('authenticated', 'public.os_profile_missing(uuid, uuid)', 'execute'));
end $$;

do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n' order by ok, check_name) into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
