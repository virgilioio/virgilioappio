-- Run after 20261023160000_os_resend_access inside a transaction that is rolled back.
-- As Allan (an admin). Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  victoria uuid := (select user_id from public.profiles where email = 'victoria@virgilio.tech');
  malena uuid := (select user_id from public.profiles where email = 'malena@virgilio.tech');
  no_sales uuid;
  plain_member uuid;
  q1 uuid; q2 uuid;
  st text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);

  -- Victoria's Gio Docs grant: one resend queued, marked, with her role, in her history.
  q1 := public.os_resend_access(ten, victoria, 'docs');
  insert into t_results values ('a resend is queued with the grant''s role',
    exists (select 1 from public.os_sync_queue where id = q1 and resend and status = 'pending'
            and app_key = 'docs' and role = 'member' and actor_user_id = allan));
  insert into t_results values ('the resend is in the person''s history',
    exists (select 1 from public.os_audit_log where subject_user_id = victoria and action = 'grant.resent' and app_key = 'docs'));

  -- A second click reuses the waiting send.
  q2 := public.os_resend_access(ten, victoria, 'docs');
  insert into t_results values ('a double click queues one send', q2 = q1
    and (select count(*) from public.os_sync_queue where user_id = victoria and app_key = 'docs' and status = 'pending') = 1);

  -- A grant in error goes back to pending.
  update public.os_app_grants set status = 'error', sync_error = 'x'
  where user_id = malena and app_key = 'docs' and status <> 'revoked';
  perform public.os_resend_access(ten, malena, 'docs');
  insert into t_results values ('a grant in error goes back to pending',
    exists (select 1 from public.os_app_grants where user_id = malena and app_key = 'docs' and status = 'pending' and sync_error is null));

  -- Refusals.
  begin
    perform public.os_resend_access(ten, victoria, 'ats');
    insert into t_results values ('the ATS has nothing to resend', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('the ATS has nothing to resend', st = 'GOS02');
  end;
  begin
    perform public.os_resend_access(ten, allan, 'docs');
    insert into t_results values ('nobody resends their own', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('nobody resends their own', st = 'GOS03');
  end;
  select m.user_id into no_sales from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.user_id <> allan
    and not exists (select 1 from public.os_app_grants g where g.user_id = m.user_id and g.app_key = 'sales' and g.status <> 'revoked')
  limit 1;
  begin
    perform public.os_resend_access(ten, no_sales, 'sales');
    insert into t_results values ('no access, nothing to resend', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('no access, nothing to resend', st = 'GOS02');
  end;

  -- Someone who isn't an admin.
  select m.user_id into plain_member from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role = 'member' and m.user_type::text = 'member'
  limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', plain_member, 'role', 'authenticated')::text, true);
  begin
    perform public.os_resend_access(ten, victoria, 'docs');
    insert into t_results values ('a member who isn''t an admin is refused', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('a member who isn''t an admin is refused', st = '42501');
  end;

  insert into t_results values ('signed-in people may call it, anonymous people may not',
    has_function_privilege('authenticated', 'public.os_resend_access(uuid, uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.os_resend_access(uuid, uuid, text)', 'execute'));
end $$;

select * from t_results;
