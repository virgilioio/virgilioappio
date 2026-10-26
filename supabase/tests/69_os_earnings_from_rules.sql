-- Run after 20261026231125_os_earnings_from_rules inside a transaction that is rolled back.
-- Gio Sales sends credits from the rules (any role, what each is on, a fixed
-- amount in its own currency) and accepted-lead credits with no invoice.
-- Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

do $$
declare
  req uuid := gen_random_uuid();
  c_sales uuid := gen_random_uuid();
  c_fixed uuid := gen_random_uuid();
  c_lead uuid := gen_random_uuid();
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  st text;
begin
  -- 1. An invoice credited by a new role and a fixed rule.
  perform public.sales_earnings_upsert(jsonb_build_object(
    'idempotency_key', 'test-' || req, 'sent_at', '2026-10-26T10:00:00Z',
    'request', jsonb_build_object('id', req, 'number', 'R-TEST', 'status', 'partly_paid', 'currency', 'MXN',
                                  'amount', 5000, 'paid_amount', 2500, 'client_name', 'Acme'),
    'credits', jsonb_build_array(
      jsonb_build_object('id', c_sales, 'role_key', 'closer', 'role_label', 'Closer', 'person_email', 'allan@virgilio.tech',
                         'basis', 'percent', 'share_pct', 10, 'base_amount', 4000, 'currency', 'MXN',
                         'earned_amount', 200, 'pending_amount', 200),
      jsonb_build_object('id', c_fixed, 'role_key', 'test_fixed', 'role_label', 'Test fixed', 'person_email', 'allan@virgilio.tech',
                         'basis', 'fixed', 'share_pct', 0, 'base_amount', 5000, 'currency', 'USD',
                         'earned_amount', 0, 'pending_amount', 50))));
  insert into t_results values ('a new role is kept with what it is on',
    (select role_key = 'closer' and basis = 'percent' and base_amount = 4000 and currency = 'MXN' and earned_amount = 200
            and user_id = allan and source = 'invoice'
       from public.os_earnings where sales_credit_id = c_sales));
  insert into t_results values ('a fixed rule keeps its own currency',
    (select basis = 'fixed' and currency = 'USD' and pending_amount = 50 and earned_amount = 0
       from public.os_earnings where sales_credit_id = c_fixed));

  -- 2. An accepted lead: earned at once, voided when undone, an older message ignored.
  perform public.sales_lead_earning_upsert(jsonb_build_object(
    'idempotency_key', 'lead-a-' || c_lead, 'sent_at', '2026-10-26T11:00:00Z',
    'credit', jsonb_build_object('id', c_lead, 'role_key', 'sdr', 'role_label', 'SDR', 'person_email', 'allan@virgilio.tech',
                                 'amount', 100, 'currency', 'USD', 'earned_on', '2026-10-26', 'status', 'earned'),
    'lead', jsonb_build_object('deal_title', 'Acme · EOR', 'client_name', 'Acme', 'partner_name', 'Multiplier', 'item_name', 'Spiff: Warm Leads')));
  insert into t_results values ('an accepted lead is earned at once, with no invoice',
    (select source = 'lead' and status = 'earned' and earned_amount = 100 and pending_amount = 0 and currency = 'USD'
            and sales_request_id is null and partner_name = 'Multiplier' and earned_on = date '2026-10-26' and user_id = allan
       from public.os_earnings where sales_credit_id = c_lead));
  perform public.sales_lead_earning_upsert(jsonb_build_object(
    'idempotency_key', 'lead-b-' || c_lead, 'sent_at', '2026-10-26T12:00:00Z',
    'credit', jsonb_build_object('id', c_lead, 'role_key', 'sdr', 'role_label', 'SDR', 'person_email', 'allan@virgilio.tech',
                                 'amount', 100, 'currency', 'USD', 'earned_on', '2026-10-26', 'status', 'void',
                                 'void_reason', 'The acceptance was undone.')));
  insert into t_results values ('an undone acceptance voids it',
    (select status = 'void' and earned_amount = 0 and void_reason = 'The acceptance was undone.'
       from public.os_earnings where sales_credit_id = c_lead));
  perform public.sales_lead_earning_upsert(jsonb_build_object(
    'idempotency_key', 'lead-c-' || c_lead, 'sent_at', '2026-10-26T11:30:00Z',
    'credit', jsonb_build_object('id', c_lead, 'role_key', 'sdr', 'role_label', 'SDR', 'person_email', 'allan@virgilio.tech',
                                 'amount', 100, 'currency', 'USD', 'earned_on', '2026-10-26', 'status', 'earned')));
  insert into t_results values ('an older message never undoes a newer one',
    (select status = 'void' from public.os_earnings where sales_credit_id = c_lead));

  -- 3. The same message twice is answered from the inbox.
  insert into t_results values ('a repeated message is a no-op',
    (public.sales_lead_earning_upsert(jsonb_build_object('idempotency_key', 'lead-a-' || c_lead,
       'credit', jsonb_build_object('id', c_lead)))->>'status') = 'earned');

  -- 4. An invoice credit still needs its invoice.
  begin
    insert into public.os_earnings (tenant_id, sales_credit_id, role_key, role_label, share_pct, currency, status, sales_sent_at)
    values ('5ba7b145-f251-4b18-8900-724cb06028ab', gen_random_uuid(), 'sdr', 'SDR', 0, 'USD', 'issued', now());
    st := 'added';
  exception when others then st := sqlstate; end;
  insert into t_results values ('an invoice credit without its invoice is refused', st = '23514');
end $$;
