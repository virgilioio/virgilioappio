-- Run after 20261023043344_os_earnings inside a transaction that is rolled back.
-- Gio Sales sends one invoice's credits: people are matched (Gio ATS id for the
-- Sourcer and Recruiter, email for Sales), the opening and job are linked, a
-- repeat is a no-op, an older message never overwrites a newer one, credits
-- that leave the invoice are voided, a person reads only their own rows and a
-- People & Access admin reads all. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  mate constant uuid := '732a3bae-e479-4b66-91e1-39b545716c1c';
  op constant uuid := '69abd0c1-e5b8-4c20-9e9b-3d2e073465b2';
  rid uuid := gen_random_uuid();
  c_sales uuid := gen_random_uuid();
  c_sp uuid := gen_random_uuid();
  c_out uuid := gen_random_uuid();
  c_new uuid := gen_random_uuid();
  base jsonb;
  res jsonb;
  n int;
begin
  base := jsonb_build_object(
    'event', 'earnings.upsert',
    'request', jsonb_build_object('id', rid, 'number', 'R-TEST', 'invoice_number', 'F-77', 'status', 'issued',
      'currency', 'USD', 'amount', 10000, 'paid_amount', 0, 'issued_on', '2026-10-20', 'paid_on', null,
      'client_name', 'Acme', 'deal_title', 'Acme AE search', 'opening_id', op),
    'credits', jsonb_build_array(
      jsonb_build_object('id', c_sales, 'role_key', 'sales_new', 'role_label', 'Sales (new client)', 'person_name', 'Allan Bravo',
        'person_email', 'ALLAN@virgilio.tech', 'ats_user_id', null, 'share_pct', 10, 'earned_amount', 0, 'pending_amount', 1000),
      jsonb_build_object('id', c_sp, 'role_key', 'sp', 'role_label', 'Sourcer', 'person_name', 'Mitzy',
        'person_email', 'mitzy@virgilio.tech', 'ats_user_id', mate, 'share_pct', 10, 'earned_amount', 0, 'pending_amount', 1000),
      jsonb_build_object('id', c_out, 'role_key', 'es', 'role_label', 'Engagement Specialist', 'person_name', 'Someone Outside',
        'person_email', 'nobody@example.com', 'ats_user_id', null, 'share_pct', 5, 'earned_amount', 0, 'pending_amount', 500)));

  -- 1. The invoice is issued.
  res := public.sales_earnings_upsert(base || jsonb_build_object('idempotency_key', 'k1', 'sent_at', '2026-10-20T10:00:00Z'));
  insert into t_results values ('three credits arrive', (res->>'credits')::int = 3 and (select count(*) from public.os_earnings where sales_request_id = rid) = 3);
  insert into t_results values ('Sales is matched by email, any case',
    (select user_id = allan from public.os_earnings where sales_credit_id = c_sales));
  insert into t_results values ('the Sourcer is matched by their Gio ATS id',
    (select user_id = mate from public.os_earnings where sales_credit_id = c_sp));
  insert into t_results values ('someone outside Virgilio stays unmatched',
    (select user_id is null from public.os_earnings where sales_credit_id = c_out));
  insert into t_results values ('the opening and its job are linked',
    (select bool_and(opening_id = op and job_id = '8c712a45-293a-4b0b-ad6c-7896375173b2') from public.os_earnings where sales_request_id = rid));
  insert into t_results values ('amounts are what Gio Sales sent',
    (select status = 'issued' and pending_amount = 1000 and earned_amount = 0 and invoice_amount = 10000 and currency = 'USD'
       from public.os_earnings where sales_credit_id = c_sp));

  -- 2. The same message again changes nothing.
  res := public.sales_earnings_upsert(base || jsonb_build_object('idempotency_key', 'k1', 'sent_at', '2026-10-20T10:00:00Z',
    'request', (base->'request') || '{"status": "paid"}'::jsonb));
  insert into t_results values ('a repeat is a no-op', (select status = 'issued' from public.os_earnings where sales_credit_id = c_sp));

  -- 3. Half is paid.
  res := public.sales_earnings_upsert(jsonb_set(jsonb_set(jsonb_set(base, '{request,status}', '"partly_paid"'), '{request,paid_amount}', '5000'),
    '{credits,1}', (base->'credits'->1) || '{"earned_amount": 500, "pending_amount": 500}'::jsonb)
    || jsonb_build_object('idempotency_key', 'k2', 'sent_at', '2026-10-21T10:00:00Z'));
  insert into t_results values ('a partial payment moves the money',
    (select status = 'partly_paid' and earned_amount = 500 and pending_amount = 500 and collected_amount = 5000
       from public.os_earnings where sales_credit_id = c_sp));

  -- 4. A late, older message is ignored.
  res := public.sales_earnings_upsert(base || jsonb_build_object('idempotency_key', 'k0', 'sent_at', '2026-10-19T10:00:00Z'));
  insert into t_results values ('an older message never overwrites a newer one',
    (select status = 'partly_paid' and earned_amount = 500 from public.os_earnings where sales_credit_id = c_sp));

  -- 5. The invoice is re-credited: the Engagement Specialist credit is replaced.
  res := public.sales_earnings_upsert(jsonb_set(base, '{credits,2}', (base->'credits'->2) || jsonb_build_object('id', c_new))
    || jsonb_build_object('idempotency_key', 'k3', 'sent_at', '2026-10-22T10:00:00Z'));
  insert into t_results values ('a credit no longer on the invoice is voided',
    (select status = 'void' and void_reason = 'Credits recalculated in Gio Sales' and pending_amount = 0
       from public.os_earnings where sales_credit_id = c_out) and (res->>'voided')::int = 1);
  insert into t_results values ('its replacement arrives',
    exists (select 1 from public.os_earnings where sales_credit_id = c_new and status = 'issued'));

  -- 6. Who reads what.
  perform set_config('request.jwt.claims', json_build_object('sub', mate, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into t_results select 'a person reads only their own earnings',
    count(*) = 1 and bool_and(user_id = mate) from public.os_earnings where sales_request_id = rid;
  begin
    insert into public.os_earnings (tenant_id, sales_credit_id, sales_request_id, request_number, role_key, role_label, share_pct, currency,
      invoice_amount, status, sales_sent_at)
    values ('5ba7b145-f251-4b18-8900-724cb06028ab', gen_random_uuid(), rid, 'X', 'sp', 'Sourcer', 1, 'USD', 1, 'issued', now());
    insert into t_results values ('the app can''t write earnings', false);
  exception when insufficient_privilege then
    insert into t_results values ('the app can''t write earnings', true);
  end;
  begin
    perform public.sales_earnings_upsert(base || '{"idempotency_key": "k9", "sent_at": "2026-10-23T10:00:00Z"}'::jsonb);
    insert into t_results values ('only the service role takes deliveries', false);
  exception when insufficient_privilege then
    insert into t_results values ('only the service role takes deliveries', true);
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  insert into t_results select 'a People & Access admin reads everyone''s',
    public.is_os_admin('5ba7b145-f251-4b18-8900-724cb06028ab') and count(*) = 4 from public.os_earnings where sales_request_id = rid;
  perform set_config('role', 'postgres', true);
end $$;

select * from t_results;
