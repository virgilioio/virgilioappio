-- Run after 20261024071257_os_tax_id_alerts inside a transaction that is rolled back.
-- An admin changes and removes a teammate's tax ID: two alerts wait for the
-- email, labelled, with no part of the number. The old bank claim skips them,
-- the new claim hands them over. The person's own change queues nothing.
-- Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  mate uuid;
  n int;
  r record;
begin
  select m.user_id into mate from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin' and m.user_id <> allan
  order by m.created_at limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', mate, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.os_save_tax_id(ten, mate, 'mx_rfc', 'GODE561231GR8');
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.os_bank_alerts where user_id = mate and kind <> 'bank' and status = 'pending';
  insert into t_results values ('their own change queues no email', n = 0);

  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.os_save_tax_id(ten, mate, 'mx_curp', 'MAHJ280603MSPRRV09');
  perform public.os_remove_tax_id(ten, mate, 'mx_rfc');
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.os_bank_alerts
  where user_id = mate and changed_by = allan and status = 'pending'
    and ((kind = 'tax_id_changed' and label = 'CURP') or (kind = 'tax_id_removed' and label = 'RFC'));
  insert into t_results values ('an admin''s change and removal each queue an email', n = 2);
  select count(*) into n from public.notifications
  where user_id = mate and metadata->>'kind' in ('tax_id_changed', 'tax_id_removed') and action_url = '/me/details';
  insert into t_results values ('the bell opens My profile''s details', n = 2);

  select count(*) into n from public.os_bank_alerts_claim(100) c
  where c.alert_id in (select id from public.os_bank_alerts where user_id = mate and kind <> 'bank');
  insert into t_results values ('the old bank claim skips tax ID alerts', n = 0);

  n := 0;
  for r in select * from public.os_account_alerts_claim(100) c
           where c.alert_id in (select id from public.os_bank_alerts where user_id = mate and kind <> 'bank') loop
    if r.to_email is not null and r.label in ('CURP', 'RFC') and r.account_last4 is null and r.bank_name is null then
      n := n + 1;
    end if;
  end loop;
  insert into t_results values ('the new claim hands them over, labelled, without bank fields', n = 2);
end $$;

do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n') into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
