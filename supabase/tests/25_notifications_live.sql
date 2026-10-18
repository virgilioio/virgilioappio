-- Run after 20261018230000_notifications_live inside a transaction that is rolled back.
create temp table t_results (check_name text, ok boolean);
insert into t_results select 'realtime: notifications are published',
  exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications');
insert into t_results select 'rls: still on for notifications',
  (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass);
insert into t_results select 'rls: people read only their own rows',
  exists (select 1 from pg_policy where polrelid = 'public.notifications'::regclass and polcmd = 'r'
          and (pg_get_expr(polqual, polrelid) ilike '%auth.uid()%user_id%' or pg_get_expr(polqual, polrelid) ilike '%user_id%auth.uid()%'));
insert into t_results select 'realtime: published once, even when the migration runs twice',
  (select count(*) = 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications');
select check_name as check, ok from t_results;
