-- Run after 20261019200000_reference_reminders inside a transaction that is
-- rolled back. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

do $$
declare
  cmd text := (select command from cron.job where jobname = 'reference-reminders');
  req uuid := (select id from public.reference_requests order by created_at desc limit 1);
  ref uuid := (select id from public.reference_referees where request_id = req limit 1);
  n int;
begin
  insert into t_results values ('the reminders job is scheduled once a day at 15:07 UTC',
    exists (select 1 from cron.job where jobname = 'reference-reminders' and schedule = '7 15 * * *' and active));
  insert into t_results values ('it calls reference-reminders with the secret from Vault, never a copy',
    cmd like '%/functions/v1/reference-reminders%' and cmd like '%vault.decrypted_secrets%'
    and cmd !~ '[0-9a-f]{64}');

  -- The job's guard is valid SQL and reads the live tables.
  execute 'select count(*) from (' || regexp_replace(
    substring(cmd from 'where exists \((.*)\);'), '\s+$', '') || ') g' into n;
  insert into t_results values ('the job''s "anyone waiting?" guard runs', n >= 0);

  insert into t_results values ('activity rows can name their referee',
    exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'reference_activity' and column_name = 'referee_id'));
  if req is not null then
    insert into public.reference_activity (request_id, type, label, referee_id)
    values (req, 'referee_reminder_sent', 'TEST reminder', ref);
    insert into t_results values ('a reminder row keeps its referee',
      exists (select 1 from public.reference_activity where label = 'TEST reminder' and referee_id is not distinct from ref));
  end if;

  insert into t_results values ('activity, referees and requests are published for live updates',
    (select count(*) from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
        and tablename in ('reference_activity', 'reference_referees', 'reference_requests')) = 3);
  insert into t_results values ('Row Level Security stays on for all three',
    (select bool_and(relrowsecurity) from pg_class
      where oid in ('public.reference_activity'::regclass, 'public.reference_referees'::regclass, 'public.reference_requests'::regclass)));
end $$;

select * from t_results;
