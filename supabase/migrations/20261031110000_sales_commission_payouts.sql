-- Commissions phase 2, Gio ATS side (plan "Gio Sales commissions module", 2026-10-31).
--
-- Dry run (rolled back, 2026-10-31): the same payout sent twice is kept once and
-- found Javier; Allan's and Javier's invoice details are complete (nothing
-- missing); an unknown email says "a Gio ATS account"; a non-admin is refused
-- the bank account (GBK01); three reads in the audit log.
--
-- 1. os_commission_payouts: a read-only copy of each member's payouts from Gio
--    Sales, so their Earnings tab shows Paid (what they've made) and Payment
--    history. Gio Sales sends commissions.payout each time a payout is marked
--    paid or a paid one goes back to approved; sales-earnings records it
--    through sales_commission_payout_upsert. Payable is never earned: only a
--    paid payout counts (Allan, 2026-10-31).
-- 2. The details Gio Sales prints on a member's invoice to Virgilio's US
--    company (os_member_invoice_details) and the bank account Billing reveals
--    to pay it (os_member_bank_reveal), for Gio Sales' server only, through the
--    sales-commission-gateway function. Both are written to the audit log, as
--    a reveal in Gio ATS is today; the full bank account never leaves Gio ATS
--    except to the person paying it.

-- ── 1. Payouts ─────────────────────────────────────────────────────────────
create table public.os_commission_payouts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sales_payout_id uuid not null unique,
  user_id uuid references auth.users(id) on delete set null,
  person_name text,
  person_email text,
  month date not null,
  currency text not null,
  total numeric(14, 2) not null,
  -- paid, or approved when Billing undid "Mark paid" (no longer counted).
  status text not null check (status in ('approved', 'paid')),
  paid_on date,
  lines integer not null default 0,
  invoice_number text,
  historical boolean not null default false,
  note text,
  sales_sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index os_commission_payouts_user on public.os_commission_payouts (tenant_id, user_id, paid_on desc);
alter table public.os_commission_payouts enable row level security;
-- The member reads their own; People & Access admins read everyone's. Nobody writes from the browser.
create policy os_commission_payouts_read on public.os_commission_payouts for select
  using (user_id = auth.uid() or public.is_os_admin(tenant_id));

create or replace function public.sales_commission_payout_upsert(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  _t constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  _key text := payload->>'idempotency_key';
  _sent timestamptz := coalesce((payload->>'sent_at')::timestamptz, now());
  _prior jsonb;
  _user uuid;
  _res jsonb;
begin
  if _key is null or nullif(payload->>'payout_id', '') is null then raise exception 'idempotency_key and payout_id are required'; end if;
  select response into _prior from public.integration_inbox where idempotency_key = _key;
  if found then return _prior; end if;

  _user := nullif(payload->>'ats_user_id', '')::uuid;
  if _user is null or not exists (select 1 from public.members m where m.tenant_id = _t and m.user_id = _user) then
    select u.id into _user
      from auth.users u join public.members m on m.user_id = u.id and m.tenant_id = _t
     where lower(u.email) = lower(btrim(payload->>'member_email'))
     limit 1;
  end if;

  insert into public.os_commission_payouts as p (
    tenant_id, sales_payout_id, user_id, person_name, person_email, month, currency, total, status,
    paid_on, lines, invoice_number, historical, note, sales_sent_at)
  values (
    _t, (payload->>'payout_id')::uuid, _user, nullif(payload->>'member_name', ''), lower(nullif(payload->>'member_email', '')),
    (payload->>'month')::date, payload->>'currency', (payload->>'total')::numeric,
    case when payload->>'status' = 'paid' then 'paid' else 'approved' end,
    case when payload->>'status' = 'paid' then nullif(payload->>'paid_on', '')::date end,
    coalesce((payload->>'lines')::int, 0), nullif(payload->>'invoice_number', ''),
    coalesce((payload->>'historical')::boolean, false), nullif(payload->>'note', ''), _sent)
  on conflict (sales_payout_id) do update set
    user_id = excluded.user_id, person_name = excluded.person_name, person_email = excluded.person_email,
    month = excluded.month, currency = excluded.currency, total = excluded.total, status = excluded.status,
    paid_on = excluded.paid_on, lines = excluded.lines, invoice_number = excluded.invoice_number,
    historical = excluded.historical, note = excluded.note, sales_sent_at = excluded.sales_sent_at, updated_at = now()
  where p.sales_sent_at <= excluded.sales_sent_at;

  _res := jsonb_build_object('ok', true, 'payout', payload->>'payout_id', 'status', payload->>'status');
  insert into public.integration_inbox (idempotency_key, endpoint, status_code, response)
  values (_key, 'sales-earnings', 200, _res)
  on conflict (idempotency_key) do nothing;
  return _res;
end $$;
revoke execute on function public.sales_commission_payout_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.sales_commission_payout_upsert(jsonb) to service_role;

-- ── 2. What Gio Sales prints, and the account Billing pays ─────────────────
-- A Virgilio member (by work email) as they'll appear on their invoice: name,
-- work email, address (the shipping address, which is where they live unless
-- they say otherwise; else their city and country), their tax ID in full (it's
-- their own invoice; written to the audit log as a reveal for that invoice) and
-- the bank account with only its last four. Says what's missing instead of
-- guessing, and then reads no tax ID at all.
create or replace function public.os_member_invoice_details(_email text, _actor_email text, _invoice text)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  _t constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  _user uuid;
  _actor uuid;
  _name text;
  _address text;
  _tax record;
  _bank record;
  _missing text[] := '{}';
begin
  select u.id into _user from auth.users u join public.members m on m.user_id = u.id and m.tenant_id = _t
   where lower(u.email) = lower(btrim(_email)) limit 1;
  if _user is null then
    return jsonb_build_object('found', false, 'missing', jsonb_build_array('a Gio ATS account'));
  end if;
  select u.id into _actor from auth.users u where lower(u.email) = lower(btrim(_actor_email)) limit 1;

  select nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '') into _name
    from public.profiles p where p.user_id = _user;

  select concat_ws(', ', nullif(s.line1, ''), nullif(s.line2, ''), nullif(s.city, ''), nullif(s.region, ''),
                   nullif(s.postal_code, ''), nullif(s.country_code, '')) into _address
    from public.os_person_shipping s where s.tenant_id = _t and s.user_id = _user and nullif(s.line1, '') is not null;
  if _address is null then
    select nullif(concat_ws(', ', nullif(d.city, ''), nullif(d.region, ''), nullif(d.country_code, '')), '') into _address
      from public.os_person_details d where d.tenant_id = _t and d.user_id = _user;
  end if;

  -- Their tax ID: the one for the country they live in first.
  select x.type_key, ty.label, x.value_enc into _tax
    from public.os_person_tax_ids x
    join public.os_tax_id_types ty on ty.key = x.type_key
    left join public.os_person_details d on d.tenant_id = x.tenant_id and d.user_id = x.user_id
   where x.tenant_id = _t and x.user_id = _user and x.removed_at is null
   order by (ty.country_code = d.country_code) desc nulls last, ty.position
   limit 1;

  select b.holder_name, b.bank_name, b.kind, b.country_code, b.currency, b.account_last4, b.routing_number, b.swift, b.account_label
    into _bank
    from public.os_person_bank b where b.tenant_id = _t and b.user_id = _user;

  if _name is null then _missing := _missing || 'name'; end if;
  if _address is null then _missing := _missing || 'address'; end if;
  if _tax.type_key is null then _missing := _missing || 'tax ID'; end if;
  if _bank.account_last4 is null then _missing := _missing || 'bank details'; end if;

  -- The tax ID is read (and logged) only when the invoice can actually be written.
  if cardinality(_missing) = 0 then
    insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, app_key, detail)
    values (_t, _actor, _user, 'person.tax_id_revealed', 'sales',
            jsonb_build_object('type', _tax.type_key, 'purpose', 'commission invoice', 'invoice', _invoice));
  end if;

  return jsonb_build_object(
    'found', true,
    'ats_user_id', _user,
    'name', _name,
    'email', lower(btrim(_email)),
    'address', _address,
    'tax_id', case when cardinality(_missing) = 0 then extensions.pgp_sym_decrypt(_tax.value_enc, public.os_bank_key()) end,
    'tax_label', _tax.label,
    'bank', case when _bank.account_last4 is not null then jsonb_build_object(
      'holder', _bank.holder_name, 'name', _bank.bank_name, 'kind', _bank.kind, 'country', _bank.country_code,
      'currency', _bank.currency, 'last4', _bank.account_last4, 'routing', _bank.routing_number,
      'swift', _bank.swift, 'label', _bank.account_label) end,
    'missing', to_jsonb(_missing));
end $$;
revoke execute on function public.os_member_invoice_details(text, text, text) from public, anon, authenticated;
grant execute on function public.os_member_invoice_details(text, text, text) to service_role;

-- The full account number, for the person paying a payout: only someone Gio ATS
-- already lets see bank details (a People & Access admin, or active Gio Sales
-- Billing), and written to the audit log like any reveal.
create or replace function public.os_member_bank_reveal(_email text, _actor_email text, _payout uuid)
returns text
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  _t constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  _user uuid;
  _actor uuid;
  _enc bytea;
begin
  select u.id into _actor from auth.users u join public.members m on m.user_id = u.id and m.tenant_id = _t and m.user_status = 'active'
   where lower(u.email) = lower(btrim(_actor_email)) limit 1;
  if _actor is null or not (
       exists (select 1 from public.members m where m.tenant_id = _t and m.user_id = _actor and m.user_status = 'active' and m.system_role = 'admin')
    or exists (select 1 from public.os_app_grants g where g.tenant_id = _t and g.user_id = _actor
                and g.app_key = 'sales' and g.role = 'billing' and g.status = 'active')) then
    raise exception 'Only People & Access admins and Gio Sales Billing see full bank accounts.' using errcode = 'GBK01';
  end if;
  select u.id into _user from auth.users u join public.members m on m.user_id = u.id and m.tenant_id = _t
   where lower(u.email) = lower(btrim(_email)) limit 1;
  select b.account_enc into _enc from public.os_person_bank b where b.tenant_id = _t and b.user_id = _user;
  if _enc is null then raise exception 'This person has no bank details on record.' using errcode = 'GBK02'; end if;
  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, app_key, detail)
  values (_t, _actor, _user, 'person.bank_revealed', 'sales', jsonb_build_object('purpose', 'commission payout', 'payout', _payout));
  return extensions.pgp_sym_decrypt(_enc, public.os_bank_key());
end $$;
revoke execute on function public.os_member_bank_reveal(text, text, uuid) from public, anon, authenticated;
grant execute on function public.os_member_bank_reveal(text, text, uuid) to service_role;
