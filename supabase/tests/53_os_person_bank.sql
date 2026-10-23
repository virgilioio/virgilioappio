-- Run after 20261023071449_os_person_bank inside a transaction that is rolled back.
-- A teammate adds their own CLABE, sees it masked and can't reveal it. Another
-- member sees nothing. Billing reads and reveals (in the history) but can't
-- edit. An admin's change rings the person's bell and queues the email. Bad
-- numbers are refused. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  clabe constant text := '012180001234567899';
  mate uuid;
  other uuid;
  outsider uuid;
  d record;
  n int;
  st text;
  shown text;
begin
  -- Two active non-admin members besides Allan, and someone outside the workspace.
  select m.user_id into mate from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin' and m.user_id <> allan
  order by m.created_at limit 1;
  select m.user_id into other from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin' and m.user_id not in (allan, mate)
  order by m.created_at limit 1;
  select u.id into outsider from auth.users u
  where not exists (select 1 from public.members m where m.user_id = u.id and m.tenant_id = ten) limit 1;

  -- 1. The person adds their own CLABE. The bank comes from its first digits.
  perform set_config('request.jwt.claims', json_build_object('sub', mate, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform public.os_save_bank_details(ten, mate, 'mx_clabe', '  Maya   Ruiz ', '', '012 180 0012-3456 7899');
  select * into d from public.os_bank_details(ten, mate);
  insert into t_results values ('the person adds their own CLABE, and the bank is named from it',
    d.has_details and d.bank_name = 'BBVA México' and d.currency = 'MXN' and d.country_code = 'MX'
    and d.holder_name = 'Maya Ruiz' and d.account_label = 'CLABE' and d.account_last4 = '7899');
  insert into t_results values ('they may edit it but not reveal it', d.can_edit and not d.can_reveal);
  begin
    perform public.os_reveal_bank_account(ten, mate);
    insert into t_results values ('the person can''t reveal the full number', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('the person can''t reveal the full number', st = 'GBK01');
  end;
  begin
    perform 1 from public.os_person_bank;
    insert into t_results values ('nobody reads the table directly', false);
  exception when insufficient_privilege then
    insert into t_results values ('nobody reads the table directly', true);
  end;
  select count(*) into n from public.notifications where user_id = mate and category::text = 'account';
  insert into t_results values ('their own change rings no bell', n = 0);

  -- 2. Another member sees nothing and changes nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  select count(*) into n from public.os_bank_details(ten, mate);
  insert into t_results values ('another member doesn''t even learn they exist', n = 0);
  begin
    perform public.os_save_bank_details(ten, mate, 'mx_clabe', 'Someone Else', null, '646180009876543212');
    insert into t_results values ('another member can''t change them', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('another member can''t change them', st = 'GBK01');
  end;

  -- 3. Billing (an active Gio Sales Billing role) reads and reveals, but doesn't edit.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  update public.os_app_grants set role = 'billing', status = 'active'
  where tenant_id = ten and user_id = other and app_key = 'sales' and status <> 'revoked';
  if not found then
    insert into public.os_app_grants (tenant_id, user_id, app_key, role, status, granted_by, granted_at)
    values (ten, other, 'sales', 'billing', 'active', allan, now());
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select * into d from public.os_bank_details(ten, mate);
  insert into t_results values ('Billing reads the masked details and may reveal, not edit',
    d.has_details and d.account_last4 = '7899' and d.can_reveal and not d.can_edit);
  shown := public.os_reveal_bank_account(ten, mate);
  insert into t_results values ('Billing reveals the full CLABE', shown = clabe);
  begin
    perform public.os_save_bank_details(ten, mate, 'mx_clabe', 'Maya Ruiz', null, '646180009876543212');
    insert into t_results values ('Billing can''t change them', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('Billing can''t change them', st = 'GBK01');
  end;

  -- 4. An admin fixes the name without retyping the number: the person hears about it.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform public.os_save_bank_details(ten, mate, 'mx_clabe', 'Maya Ruiz López', 'BBVA México', null);
  shown := public.os_reveal_bank_account(ten, mate);
  insert into t_results values ('a blank account number keeps the one on record', shown = clabe);
  perform set_config('role', 'postgres', true);
  insert into t_results values ('the bell tells the person who changed it',
    exists (select 1 from public.notifications x where x.user_id = mate and x.category::text = 'account'
            and x.actor_user_id = allan and x.subtitle like '%•••• 7899' and x.subtitle not like '%' || clabe || '%'));
  insert into t_results values ('and an email waits for os-sync',
    exists (select 1 from public.os_bank_alerts a where a.user_id = mate and a.changed_by = allan and a.status = 'pending'));

  -- 5. The number is encrypted at rest, and the history holds field names only.
  insert into t_results values ('the number is stored encrypted',
    (select encode(b.account_enc, 'escape') not like '%' || clabe || '%' and b.account_last4 = '7899'
     from public.os_person_bank b where b.tenant_id = ten and b.user_id = mate));
  insert into t_results values ('the history records changes by field, never the number',
    (select count(*) from public.os_audit_log a where a.subject_user_id = mate and a.action = 'person.bank_updated') = 2
    and exists (select 1 from public.os_audit_log a where a.subject_user_id = mate and a.action = 'person.bank_updated'
                and a.actor_id = allan and a.detail->'fields' = '["holder_name"]'::jsonb)
    and not exists (select 1 from public.os_audit_log a where a.subject_user_id = mate and a.detail::text like '%' || clabe || '%'));
  insert into t_results values ('every reveal is in the history, without the number',
    (select count(*) from public.os_audit_log a where a.subject_user_id = mate and a.action = 'person.bank_revealed'
     and a.detail->>'field' = 'CLABE') = 2);

  -- 6. Bad numbers are refused with a specific message.
  perform set_config('role', 'authenticated', true);
  begin
    perform public.os_save_bank_details(ten, mate, 'mx_clabe', 'Maya Ruiz', null, '012180001234567890');
    insert into t_results values ('a CLABE with a wrong check digit is refused', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('a CLABE with a wrong check digit is refused', st = 'GBK02');
  end;
  begin
    perform public.os_save_bank_details(ten, mate, 'us_account', 'Maya Ruiz', 'Chase', '123456789', null, null, '021000022', 'checking');
    insert into t_results values ('a bad routing number is refused', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('a bad routing number is refused', st = 'GBK02');
  end;
  begin
    perform public.os_save_bank_details(ten, mate, 'intl', 'Maya Ruiz', 'Commerzbank', 'DE89370400440532013001', 'EUR', null, null, null, 'COBADEFFXXX');
    insert into t_results values ('a bad IBAN is refused', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('a bad IBAN is refused', st = 'GBK02');
  end;
  begin
    perform public.os_save_bank_details(ten, mate, 'us_account', 'Maya Ruiz', 'Chase', null, null, null, '021000021', 'checking');
    insert into t_results values ('switching to another kind of account needs its number', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('switching to another kind of account needs its number', st = 'GBK02');
  end;

  -- 7. A US account and an IBAN are taken.
  perform public.os_save_bank_details(ten, mate, 'us_account', 'Maya Ruiz', 'Chase', '000123456789', null, null, '021000021', 'Checking');
  select * into d from public.os_bank_details(ten, mate);
  insert into t_results values ('a US account is taken in USD',
    d.kind = 'us_account' and d.country_code = 'US' and d.currency = 'USD' and d.routing_number = '021000021'
    and d.account_type = 'checking' and d.account_label = 'Account number' and d.account_last4 = '6789');
  perform public.os_save_bank_details(ten, mate, 'intl', 'Maya Ruiz', 'Commerzbank', 'de89 3704 0044 0532 0130 00', 'eur', null, null, null, 'cobadeffxxx');
  select * into d from public.os_bank_details(ten, mate);
  insert into t_results values ('an IBAN is taken, its country read from it',
    d.kind = 'intl' and d.country_code = 'DE' and d.currency = 'EUR' and d.swift = 'COBADEFFXXX'
    and d.account_label = 'IBAN' and d.account_last4 = '3000' and d.routing_number is null);

  -- 8. Only members of the workspace.
  begin
    perform public.os_save_bank_details(ten, outsider, 'mx_clabe', 'Somebody', null, clabe);
    insert into t_results values ('someone outside the workspace is refused', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('someone outside the workspace is refused', st = 'GBK02');
  end;

  -- 9. The email side is for the service only.
  insert into t_results values ('the app can''t claim alerts or read the key',
    not has_function_privilege('authenticated', 'public.os_bank_alerts_claim(int)', 'execute')
    and not has_function_privilege('authenticated', 'public.os_bank_key()', 'execute')
    and not has_function_privilege('anon', 'public.os_bank_details(uuid,uuid)', 'execute'));
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.os_bank_alerts_claim(100) c where c.to_email is not null and c.account_last4 = '3000';
  insert into t_results values ('os-sync claims the alerts with the person''s email', n >= 2);
  perform public.os_bank_alerts_finish(a.id, true) from public.os_bank_alerts a where a.user_id = mate;
  insert into t_results values ('a sent alert is settled',
    not exists (select 1 from public.os_bank_alerts a where a.user_id = mate and a.status <> 'sent'));
end $$;

do $$ begin raise exception 'RESULTS %', (select count(*) filter (where ok) || ' of ' || count(*) || ' passed, failed: ' || coalesce(string_agg(check_name, ' | ') filter (where not ok), 'none') from t_results); end $$;
