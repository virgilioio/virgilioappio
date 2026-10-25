-- Run after 20261025170000_chat_retire_tables inside a transaction that is rolled back.
-- Chat's tables, functions, enums and columns are gone; the reference-check
-- rate limiter and Ask Gio's tables stay; platform_remove_workspace no longer
-- reads Chat and still answers. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

do $$
declare
  n int;
  st text;
begin
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'public' and c.relname like 'chat\_%' and c.relkind in ('r', 'p')
    and c.relname <> 'chat_rate_limits';
  insert into t_results values ('Chat''s tables are gone', n = 0);

  select count(*) into n from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname ilike '%chat%'
    and p.proname not in ('chat_bump_rate_limit');
  insert into t_results values ('Chat''s functions are gone', n = 0);

  select count(*) into n from pg_type t
  where t.typnamespace = 'public'::regnamespace and t.typname in ('chat_notification_kind', 'chat_notification_status');
  insert into t_results values ('Chat''s enums are gone', n = 0);

  select count(*) into n from information_schema.columns
  where table_schema = 'public' and table_name in ('tenants', 'job_postings', 'notification_preferences')
    and column_name like 'chat\_%';
  insert into t_results values ('Chat''s columns are gone', n = 0);

  insert into t_results values ('the reference-check rate limiter stays',
    to_regclass('public.chat_rate_limits') is not null
    and exists (select 1 from pg_proc where proname = 'chat_bump_rate_limit'));
  insert into t_results values ('Ask Gio''s tables stay',
    to_regclass('public.ai_conversations') is not null and to_regclass('public.conversation_messages') is not null);

  insert into t_results values ('workspace removal no longer reads Chat',
    (select prosrc from pg_proc where proname = 'platform_remove_workspace') not ilike '%chat\_%');
  begin
    perform public.platform_remove_workspace(gen_random_uuid(), gen_random_uuid(), false);
    insert into t_results values ('workspace removal still answers (refuses a non-admin)', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('workspace removal still answers (refuses a non-admin)', st = 'GW002');
  end;

  insert into t_results values ('the retention check still runs',
    (select count(*) from public.candidates_due_for_retention('5ba7b145-f251-4b18-8900-724cb06028ab', 10)) >= 0);
end $$;

do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n') into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
