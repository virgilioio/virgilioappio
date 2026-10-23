-- Run after 20261023012116_os_commission_rates inside a transaction that is rolled back.
-- Allan (a People & Access admin) adds a rate; a member reads but can't add or
-- change one; only Virgilio's workspace has rates; delivery is recorded only by
-- the service role. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  mate uuid;
  rid uuid;
  n int;
  st text;
  row_ public.os_commission_rates%rowtype;
begin
  select m.user_id into mate from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin' and m.user_id <> allan
  order by m.created_at limit 1;

  insert into t_results values ('the five Exhibit A rates start delivered',
    (select count(*) from public.os_commission_rates where tenant_id = ten and effective_from = date '2026-01-01' and sync_status = 'done') = 5);

  -- 1. An admin adds a rate: signed, waiting for delivery, in the history.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.os_commission_rates (tenant_id, role_key, pct, effective_from, note)
  values (ten, 'tap', 22, date '2027-01-01', '  New TA plan  ') returning id into rid;
  select * into row_ from public.os_commission_rates where id = rid;
  insert into t_results values ('an admin adds a rate, signed and waiting for delivery',
    row_.created_by = allan and row_.sync_status = 'pending' and row_.note = 'New TA plan');
  insert into t_results values ('the history records it',
    exists (select 1 from public.os_audit_log a where a.action = 'commission.rate_added' and a.actor_id = allan
            and a.detail->>'role_key' = 'tap' and (a.detail->>'pct')::numeric = 22));
  insert into t_results values ('the rate in force follows the dates',
    public.os_commission_rate(ten, 'tap', date '2027-03-01') = 22 and public.os_commission_rate(ten, 'tap', date '2026-06-01') = 20);

  -- 2. Bad rows are refused.
  begin
    insert into public.os_commission_rates (tenant_id, role_key, pct, effective_from) values (ten, 'tap', 23, date '2027-01-01');
    insert into t_results values ('a second rate for the same role and date is refused', false);
  exception when unique_violation then
    insert into t_results values ('a second rate for the same role and date is refused', true);
  end;
  begin
    insert into public.os_commission_rates (tenant_id, role_key, pct, effective_from) values (ten, 'boss', 5, date '2027-01-01');
    insert into t_results values ('an unknown role is refused', false);
  exception when check_violation then
    insert into t_results values ('an unknown role is refused', true);
  end;
  begin
    insert into public.os_commission_rates (tenant_id, role_key, pct, effective_from) values (ten, 'sp', 120, date '2027-01-01');
    insert into t_results values ('over 100 percent is refused', false);
  exception when check_violation then
    insert into t_results values ('over 100 percent is refused', true);
  end;
  begin
    insert into public.os_commission_rates (tenant_id, role_key, pct, effective_from, sync_status)
    values (ten, 'sp', 12, date '2027-01-01', 'done');
    insert into t_results values ('nobody marks a rate delivered themselves', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('nobody marks a rate delivered themselves', st = '42501');
  end;
  begin
    update public.os_commission_rates set pct = 1 where id = rid;
    insert into t_results values ('rates are never edited, only added', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('rates are never edited, only added', st = '42501');
  end;

  -- 3. A member reads them but can't add one.
  perform set_config('request.jwt.claims', json_build_object('sub', mate, 'role', 'authenticated')::text, true);
  select count(*) into n from public.os_commission_rates where tenant_id = ten;
  insert into t_results values ('a member reads the rates', n = 6);
  begin
    insert into public.os_commission_rates (tenant_id, role_key, pct, effective_from) values (ten, 'sp', 50, date '2027-02-01');
    insert into t_results values ('a member can''t add a rate', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('a member can''t add a rate', st = '42501');
  end;
  insert into t_results values ('signed-in people can''t record delivery',
    not has_function_privilege('authenticated', 'public.os_commission_rate_record(uuid, boolean, text, boolean)', 'execute'));
  perform set_config('role', 'postgres', true);

  -- 4. Only Virgilio has rates.
  begin
    insert into public.os_commission_rates (tenant_id, role_key, pct, effective_from)
    values ((select id from public.tenants where id <> ten limit 1), 'sp', 10, date '2027-01-01');
    insert into t_results values ('another workspace can''t have rates', false);
  exception when check_violation then
    insert into t_results values ('another workspace can''t have rates', true);
  end;

  -- 5. Delivery is recorded: a retry stays pending, an answer settles it.
  perform public.os_commission_rate_record(rid, false, 'HTTP 503', true);
  insert into t_results values ('a failed send stays pending with its reason',
    (select sync_status = 'pending' and sync_attempts = 1 and sync_error = 'HTTP 503' from public.os_commission_rates where id = rid));
  perform public.os_commission_rate_record(rid, true, null, false);
  insert into t_results values ('a delivered rate is done',
    (select sync_status = 'done' and synced_at is not null and sync_error is null from public.os_commission_rates where id = rid));
end $$;

select * from t_results;
