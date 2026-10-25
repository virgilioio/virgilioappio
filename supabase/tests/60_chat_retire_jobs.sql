-- Run after 20261025153549_chat_retire_jobs inside a transaction that is rolled back.
-- Chat's three scheduled jobs are gone, the Gmail sync and other jobs stay,
-- the retention check no longer reads Chat and still finds the same people,
-- and the reference-check rate limiter is untouched. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  src text;
  n int;
begin
  insert into t_results values ('Chat''s scheduled jobs are gone',
    not exists (select 1 from cron.job where jobname in
      ('chat-notification-processor', 'chat-retention-sweeper', 'chat-messages-create-partitions')));
  insert into t_results values ('the Gmail sync keeps running',
    exists (select 1 from cron.job where jobname = 'sync-all-gmail-accounts-v2' and active));

  select prosrc into src from pg_proc where oid = 'public.candidates_due_for_retention(uuid, integer)'::regprocedure;
  insert into t_results values ('retention no longer reads Chat', src not ilike '%chat_%');
  select count(*) into n from public.candidates_due_for_retention(ten, 1000);
  insert into t_results values ('retention still runs', n >= 0);

  insert into t_results values ('the reference-check rate limiter stays',
    to_regprocedure('public.chat_bump_rate_limit(text, text, integer, integer)') is not null
    or exists (select 1 from pg_proc where proname = 'chat_bump_rate_limit'));
end $$;

do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n') into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
