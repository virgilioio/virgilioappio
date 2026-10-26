-- Earnings from the commission rules (Allan, 2026-10-26, step 2).
--
-- Gio Sales now credits from the commission roles and rules (any role, not
-- only the five built in), and a lead a partner accepts credits the people a
-- lead-accepted rule names at once (the SDR's USD 100), without an invoice.
-- So os_earnings takes:
--
-- 1. Any role key, and what each credit is on: `basis` (percent or fixed),
--    `base_amount` (the part of the invoice the rule is on), `role_id` (the
--    Gio ATS role), and the credit's own currency (a fixed rule's).
-- 2. Accepted-lead credits (`source = 'lead'`): no invoice, status 'earned'
--    or 'void', with the partner, the item and the day it was earned. An
--    invoice credit still has its request, number and amount.
-- 3. sales_earnings_upsert keeps the new fields; sales_lead_earning_upsert
--    takes one lead credit (sales-earnings, event earnings.lead).
--
-- Swaps two checks and loosens three not-null columns: applied from a desktop chat.

-- ── 1 and 2. The table ────────────────────────────────────────────────────
alter table public.os_earnings drop constraint os_earnings_role_key_check;
alter table public.os_earnings add constraint os_earnings_role_key_check
  check (role_key ~ '^[a-z][a-z0-9_]{1,39}$');
alter table public.os_earnings drop constraint os_earnings_status_check;
alter table public.os_earnings add constraint os_earnings_status_check
  check (status in ('issued', 'partly_paid', 'paid', 'void', 'earned'));

alter table public.os_earnings
  alter column sales_request_id drop not null,
  alter column request_number drop not null,
  alter column invoice_amount drop not null;

alter table public.os_earnings
  add column source text not null default 'invoice' check (source in ('invoice', 'lead')),
  add column basis text not null default 'percent' check (basis in ('percent', 'fixed')),
  add column base_amount numeric(14, 2),
  add column role_id uuid,
  add column partner_name text,
  add column item_name text,
  add column earned_on date,
  add constraint os_earnings_source_shape check (
    (source = 'invoice' and sales_request_id is not null and request_number is not null and invoice_amount is not null
       and status in ('issued', 'partly_paid', 'paid', 'void'))
    or (source = 'lead' and status in ('earned', 'void') and earned_on is not null));

comment on column public.os_earnings.base_amount is
  'An invoice credit: the part of the invoice its rule is on (the lines with the rule''s fees). Null on credits sent before the rules: the whole invoice.';
comment on column public.os_earnings.source is
  'invoice: a credit on a client invoice. lead: earned when a partner accepted a lead (no invoice).';

-- ── 3. What Gio Sales sends ───────────────────────────────────────────────
-- One invoice and every credit on it. Credits no longer on the invoice
-- (re-issued with new credits) are voided here.
create or replace function public.sales_earnings_upsert(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _t constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  _key text := payload->>'idempotency_key';
  _r jsonb := payload->'request';
  _rid uuid := (_r->>'id')::uuid;
  _sent timestamptz := coalesce((payload->>'sent_at')::timestamptz, now());
  _prior jsonb;
  _opening uuid;
  _job uuid;
  _c jsonb;
  _user uuid;
  _ids uuid[] := '{}';
  _n int := 0;
  _voided int := 0;
  _res jsonb;
begin
  if _key is null or _rid is null then raise exception 'idempotency_key and request.id are required'; end if;
  select response into _prior from public.integration_inbox where idempotency_key = _key;
  if found then return _prior; end if;

  select o.id, o.job_id into _opening, _job from public.job_openings o where o.id::text = _r->>'opening_id';

  for _c in select * from jsonb_array_elements(coalesce(payload->'credits', '[]'::jsonb)) loop
    -- The Sourcer and Recruiter come with their Gio ATS id. Everyone else is
    -- matched by email to a member of Virgilio.
    _user := null;
    if nullif(_c->>'ats_user_id', '') is not null then
      select u.id into _user from auth.users u where u.id = (_c->>'ats_user_id')::uuid;
    end if;
    if _user is null and nullif(btrim(_c->>'person_email'), '') is not null then
      select u.id into _user
      from auth.users u join public.members m on m.user_id = u.id and m.tenant_id = _t
      where lower(u.email) = lower(btrim(_c->>'person_email'))
      limit 1;
    end if;

    insert into public.os_earnings as e (
      tenant_id, sales_credit_id, sales_request_id, request_number, invoice_number, client_name, deal_title,
      opening_id, job_id, user_id, person_name, person_email, role_key, role_label, share_pct, currency,
      invoice_amount, collected_amount, earned_amount, pending_amount, status, void_reason, issued_on, paid_on, sales_sent_at,
      source, basis, base_amount, role_id)
    values (
      _t, (_c->>'id')::uuid, _rid, _r->>'number', nullif(_r->>'invoice_number', ''), nullif(_r->>'client_name', ''), nullif(_r->>'deal_title', ''),
      _opening, _job, _user, nullif(_c->>'person_name', ''), nullif(_c->>'person_email', ''), _c->>'role_key', _c->>'role_label',
      coalesce((_c->>'share_pct')::numeric, 0), coalesce(nullif(_c->>'currency', ''), _r->>'currency'),
      (_r->>'amount')::numeric, (_r->>'paid_amount')::numeric, (_c->>'earned_amount')::numeric, (_c->>'pending_amount')::numeric,
      _r->>'status', case when _r->>'status' = 'void' then 'Invoice voided in Gio Sales' end,
      (_r->>'issued_on')::date, (_r->>'paid_on')::date, _sent,
      'invoice', coalesce(nullif(_c->>'basis', ''), 'percent'), (_c->>'base_amount')::numeric, nullif(_c->>'role_id', '')::uuid)
    on conflict (sales_credit_id) do update set
      request_number = excluded.request_number, invoice_number = excluded.invoice_number,
      client_name = excluded.client_name, deal_title = excluded.deal_title,
      opening_id = excluded.opening_id, job_id = excluded.job_id, user_id = excluded.user_id,
      person_name = excluded.person_name, person_email = excluded.person_email,
      role_key = excluded.role_key, role_label = excluded.role_label, share_pct = excluded.share_pct,
      currency = excluded.currency, invoice_amount = excluded.invoice_amount, collected_amount = excluded.collected_amount,
      earned_amount = excluded.earned_amount, pending_amount = excluded.pending_amount,
      status = excluded.status, void_reason = excluded.void_reason,
      issued_on = excluded.issued_on, paid_on = excluded.paid_on, sales_sent_at = excluded.sales_sent_at,
      basis = excluded.basis, base_amount = excluded.base_amount, role_id = excluded.role_id, updated_at = now()
    -- An older message never overwrites a newer one.
    where e.sales_sent_at <= excluded.sales_sent_at;

    _ids := _ids || (_c->>'id')::uuid;
    _n := _n + 1;
  end loop;

  update public.os_earnings
  set status = 'void', void_reason = 'Credits recalculated in Gio Sales', earned_amount = 0, pending_amount = 0,
      sales_sent_at = _sent, updated_at = now()
  where sales_request_id = _rid and status <> 'void' and not (sales_credit_id = any (_ids)) and sales_sent_at <= _sent;
  get diagnostics _voided = row_count;

  _res := jsonb_build_object('ok', true, 'credits', _n, 'voided', _voided);
  insert into public.integration_inbox (idempotency_key, endpoint, status_code, response)
  values (_key, 'sales-earnings', 200, _res)
  on conflict (idempotency_key) do nothing;
  return _res;
end
$$;

revoke execute on function public.sales_earnings_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.sales_earnings_upsert(jsonb) to service_role;

-- One credit earned when a partner accepted a lead.
create or replace function public.sales_lead_earning_upsert(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _t constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  _key text := payload->>'idempotency_key';
  _c jsonb := payload->'credit';
  _l jsonb := coalesce(payload->'lead', '{}'::jsonb);
  _sent timestamptz := coalesce((payload->>'sent_at')::timestamptz, now());
  _prior jsonb;
  _user uuid;
  _earned boolean := (_c->>'status') = 'earned';
  _res jsonb;
begin
  if _key is null or nullif(_c->>'id', '') is null then raise exception 'idempotency_key and credit.id are required'; end if;
  select response into _prior from public.integration_inbox where idempotency_key = _key;
  if found then return _prior; end if;

  if nullif(btrim(_c->>'person_email'), '') is not null then
    select u.id into _user
    from auth.users u join public.members m on m.user_id = u.id and m.tenant_id = _t
    where lower(u.email) = lower(btrim(_c->>'person_email'))
    limit 1;
  end if;

  insert into public.os_earnings as e (
    tenant_id, sales_credit_id, client_name, deal_title, user_id, person_name, person_email,
    role_key, role_label, role_id, share_pct, currency, collected_amount, earned_amount, pending_amount,
    status, void_reason, sales_sent_at, source, basis, partner_name, item_name, earned_on)
  values (
    _t, (_c->>'id')::uuid, nullif(_l->>'client_name', ''), nullif(_l->>'deal_title', ''), _user,
    nullif(_c->>'person_name', ''), nullif(_c->>'person_email', ''),
    _c->>'role_key', _c->>'role_label', nullif(_c->>'role_id', '')::uuid, 0, _c->>'currency', 0,
    case when _earned then (_c->>'amount')::numeric else 0 end, 0,
    case when _earned then 'earned' else 'void' end, case when _earned then null else nullif(_c->>'void_reason', '') end,
    _sent, 'lead', 'fixed', nullif(_l->>'partner_name', ''), nullif(_l->>'item_name', ''), (_c->>'earned_on')::date)
  on conflict (sales_credit_id) do update set
    client_name = excluded.client_name, deal_title = excluded.deal_title, user_id = excluded.user_id,
    person_name = excluded.person_name, person_email = excluded.person_email,
    role_key = excluded.role_key, role_label = excluded.role_label, role_id = excluded.role_id,
    currency = excluded.currency, earned_amount = excluded.earned_amount,
    status = excluded.status, void_reason = excluded.void_reason, sales_sent_at = excluded.sales_sent_at,
    partner_name = excluded.partner_name, item_name = excluded.item_name, earned_on = excluded.earned_on, updated_at = now()
  where e.sales_sent_at <= excluded.sales_sent_at;

  _res := jsonb_build_object('ok', true, 'credit', _c->>'id', 'status', case when _earned then 'earned' else 'void' end);
  insert into public.integration_inbox (idempotency_key, endpoint, status_code, response)
  values (_key, 'sales-earnings', 200, _res)
  on conflict (idempotency_key) do nothing;
  return _res;
end
$$;

revoke execute on function public.sales_lead_earning_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.sales_lead_earning_upsert(jsonb) to service_role;
