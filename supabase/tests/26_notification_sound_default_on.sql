-- Inside a transaction that is rolled back: run the first line, then the migration
-- 20261018240000_notification_sound_default_on, then the rest.
create temp table t_quiet_before as select user_id, quiet_hours_enabled from public.notification_preferences;
-- (migration here)
create temp table t_results (check_name text, ok boolean);
insert into t_results select 'default: new preferences start with the sound on',
  (select column_default = 'true' from information_schema.columns
   where table_schema = 'public' and table_name = 'notification_preferences' and column_name = 'sound_on_mention');
insert into t_results select 'existing: everyone has the sound on',
  not exists (select 1 from public.notification_preferences where not sound_on_mention);
insert into t_results select 'existing: nothing else changed (quiet hours kept)',
  (select count(*) from public.notification_preferences where quiet_hours_enabled) = (select count(*) from t_quiet_before where quiet_hours_enabled);
insert into t_results select 'existing: every row still there',
  (select count(*) from public.notification_preferences) = (select count(*) from t_quiet_before);
select check_name as check, ok from t_results;
