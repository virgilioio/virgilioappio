-- Run after 20261023060702_os_my_profile inside a transaction that is rolled
-- back. A member (Mitzy, job role TA / Sourcer) reads only their own row and
-- their own job role, never the rating, the history, someone else's personal
-- details or another job role. An admin still reads everyone. Nobody signed in
-- reads nothing. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated, anon;

do $$
declare
  t constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  mate constant uuid := '732a3bae-e479-4b66-91e1-39b545716c1c';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  everyone int := (select count(*) from public.members where tenant_id = t);
  bundles int := (select count(*) from public.os_bundles where tenant_id = t);
  mate_bundle uuid := (select bundle_id from public.os_person_profile where tenant_id = t and user_id = mate);
begin
  perform set_config('request.jwt.claims', json_build_object('sub', mate, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into t_results select 'a member reads only their own row',
    count(*) = 1 and bool_and(user_id = mate) from public.os_people(t);
  insert into t_results select 'with their job role and job counts',
    bool_and(bundle_id = mate_bundle and active_jobs >= 0) from public.os_people(t);
  insert into t_results select 'they read their own job role and no other',
    count(*) = 1 and bool_and(id = mate_bundle) from public.os_bundles where tenant_id = t;
  insert into t_results select 'never a rating', count(*) = 0 from public.os_person_rating where tenant_id = t;
  insert into t_results select 'never the history', count(*) = 0 from public.os_audit_log where tenant_id = t;
  insert into t_results select 'never anyone else''s personal details',
    count(*) = 0 from public.os_person_details where tenant_id = t and user_id <> mate;
  with u as (update public.os_bundles set name = name where id = mate_bundle returning 1)
  insert into t_results select 'they still can''t change their job role', count(*) = 0 from u;

  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  insert into t_results select 'an admin still reads everyone', count(*) = everyone from public.os_people(t);
  insert into t_results select 'and every job role', count(*) = bundles from public.os_bundles where tenant_id = t;

  perform set_config('request.jwt.claims', '', true);
  insert into t_results select 'a session with no one signed in reads nobody', count(*) = 0 from public.os_people(t);
  perform set_config('role', 'postgres', true);
  insert into t_results values ('the public can''t call it at all',
    not has_function_privilege('anon', 'public.os_people(uuid)', 'execute'));
  insert into t_results values ('the public can''t ask for a job role id',
    not has_function_privilege('anon', 'public.os_my_bundle_id(uuid)', 'execute'));
end $$;

select * from t_results;
