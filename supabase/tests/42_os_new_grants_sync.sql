-- Run after 20261023130000_os_new_grants_sync inside a transaction that is rolled back.
-- As Allan (an admin): a first grant, a role change and a removal each queue one
-- send; the grants left waiting since 2026-10-16 are queued. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  victoria uuid := (select user_id from public.profiles where email = 'victoria@virgilio.tech');
  someone uuid;
  n int;
begin
  -- The grants left waiting are queued, Victoria's Gio Docs grant among them.
  insert into t_results values ('no pending app grant is left without a queued send',
    not exists (select 1 from public.os_app_grants g
                where g.status = 'pending' and g.app_key <> 'ats'
                  and not exists (select 1 from public.os_sync_queue q where q.tenant_id = g.tenant_id
                                  and q.user_id = g.user_id and q.app_key = g.app_key and q.status = 'pending')));
  insert into t_results values ('Victoria''s Gio Docs grant is queued as the admin who granted it',
    exists (select 1 from public.os_sync_queue q where q.user_id = victoria and q.app_key = 'docs'
            and q.status = 'pending' and q.role = 'member' and q.actor_user_id = allan));

  -- A member with no Gio Sales grant at all.
  select m.user_id into someone from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.user_id <> allan
    and not exists (select 1 from public.os_app_grants g where g.user_id = m.user_id and g.app_key = 'sales')
  limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);

  -- 1. A first grant: the bug left this one unqueued.
  perform public.os_set_app_role(ten, someone, 'sales', 'read_only');
  insert into t_results values ('a first grant is pending and queued once',
    (select count(*) from public.os_app_grants where user_id = someone and app_key = 'sales' and status = 'pending' and role = 'read_only') = 1
    and (select count(*) from public.os_sync_queue where user_id = someone and app_key = 'sales' and status = 'pending' and role = 'read_only') = 1);

  -- 2. Changing the role: the old send is superseded by the new one.
  perform public.os_set_app_role(ten, someone, 'sales', 'rep');
  select count(*) into n from public.os_sync_queue where user_id = someone and app_key = 'sales' and status = 'pending';
  insert into t_results values ('a role change queues one send and supersedes the old',
    n = 1 and exists (select 1 from public.os_sync_queue where user_id = someone and app_key = 'sales' and status = 'pending' and role = 'rep')
    and exists (select 1 from public.os_sync_queue where user_id = someone and app_key = 'sales' and status = 'superseded'));

  -- 3. Choosing the same role again sends nothing new.
  perform public.os_set_app_role(ten, someone, 'sales', 'rep');
  insert into t_results values ('the same role again sends nothing new',
    (select count(*) from public.os_sync_queue where user_id = someone and app_key = 'sales') = 2);

  -- 4. Taking the access away is queued as a removal.
  perform public.os_set_app_role(ten, someone, 'sales', null);
  insert into t_results values ('a removal is queued',
    exists (select 1 from public.os_sync_queue where user_id = someone and app_key = 'sales' and status = 'pending' and role is null)
    and not exists (select 1 from public.os_app_grants where user_id = someone and app_key = 'sales' and status <> 'revoked'));
end $$;

select * from t_results;
