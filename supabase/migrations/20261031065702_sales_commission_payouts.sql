-- Commissions phase 2, Gio ATS side (plan "Gio Sales commissions module", 2026-10-31).
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
--    except to the person paying it. The tax ID prints in full (it's the
--    member's own invoice); only the bank account is masked (Allan, 2026-10-31).
-- 3. os_person_tax_address: the address on a member's invoices, beside the
--    shipping address, with "Same as shipping address" (Allan, 2026-10-31).
--    Kept like the shipping address: the person and People & Access admins
--    only, never external users (GEX02), the history names the fields that
--    changed and never their values, rows never removed.
--
-- Dry run (rolled back, 2026-10-31): the same payout sent twice is kept once and
-- found Javier; with no tax address the invoice can't be written ("tax address"
-- missing, no tax ID read); "Same as shipping address" fills it from the
-- shipping address; an address of their own is trimmed and its country upper
-- cased, and turning "Same as shipping" back on clears it; an unknown email
-- says "a Gio ATS account"; a non-admin is refused the bank account (GBK01);
-- every change and reveal is in the audit log.

-- ── 0. Tax address ─────────────────────────────────────────────────────────
create table public.os_person_tax_address (
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  -- On: the invoice uses the shipping address; the fields below stay empty.
  same_as_shipping boolean not null default true,
  line1 text check (line1 is null or length(line1) <= 200),
  line2 text check (line2 is null or length(line2) <= 200),
  city text check (city is null or length(city) <= 100),
  region text check (region is null or length(region) <= 100),
  postal_code text check (postal_code is null or length(postal_code) <= 20),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
comment on table public.os_person_tax_address is
  'The address on a person''s invoices to Virgilio, or the shipping address: People & Access admins and the person themself only.';

create or replace function public.os_person_tax_address_validate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.same_as_shipping then
    new.line1 := null; new.line2 := null; new.city := null; new.region := null;
    new.postal_code := null; new.country_code := null;
  else
    new.line1 := nullif(btrim(new.line1), '');
    new.line2 := nullif(btrim(new.line2), '');
    new.city := nullif(btrim(new.city), '');
    new.region := nullif(btrim(new.region), '');
    new.postal_code := nullif(upper(btrim(new.postal_code)), '');
    new.country_code := nullif(upper(btrim(new.country_code)), '');
  end if;
  if tg_op = 'UPDATE' and (new.tenant_id <> old.tenant_id or new.user_id <> old.user_id) then
    raise exception 'A tax address can''t move to another person.' using errcode = 'GOS02';
  end if;
  if not exists (select 1 from public.members m where m.tenant_id = new.tenant_id and m.user_id = new.user_id) then
    raise exception 'This person is not a member of the workspace.' using errcode = 'GOS02';
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$function$;

create trigger a0_os_person_tax_address_external
  before insert or update on public.os_person_tax_address
  for each row execute function public.os_refuse_external();
create trigger os_person_tax_address_validate
  before insert or update on public.os_person_tax_address
  for each row execute function public.os_person_tax_address_validate();

-- History: which fields changed, by whom. No values.
create or replace function public.os_person_tax_address_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  changed text[] := '{}';
begin
  if new.same_as_shipping is distinct from (case when tg_op = 'UPDATE' then old.same_as_shipping end) then changed := array_append(changed, 'same_as_shipping'); end if;
  if new.line1 is distinct from (case when tg_op = 'UPDATE' then old.line1 end)
     or new.line2 is distinct from (case when tg_op = 'UPDATE' then old.line2 end) then changed := array_append(changed, 'street'); end if;
  if new.city is distinct from (case when tg_op = 'UPDATE' then old.city end) then changed := array_append(changed, 'city'); end if;
  if new.region is distinct from (case when tg_op = 'UPDATE' then old.region end) then changed := array_append(changed, 'region'); end if;
  if new.postal_code is distinct from (case when tg_op = 'UPDATE' then old.postal_code end) then changed := array_append(changed, 'postal_code'); end if;
  if new.country_code is distinct from (case when tg_op = 'UPDATE' then old.country_code end) then changed := array_append(changed, 'country'); end if;
  if cardinality(changed) = 0 then
    return new;
  end if;
  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (new.tenant_id, auth.uid(), new.user_id, 'person.tax_address_updated', jsonb_build_object('fields', to_jsonb(changed)));
  return new;
end;
$function$;
create trigger os_person_tax_address_audit
  after insert or update on public.os_person_tax_address
  for each row execute function public.os_person_tax_address_audit();

alter table public.os_person_tax_address enable row level security;
create policy os_person_tax_address_read on public.os_person_tax_address
  for select to authenticated
  using (public.is_os_admin(tenant_id) or user_id = auth.uid());
create policy os_person_tax_address_insert on public.os_person_tax_address
  for insert to authenticated
  with check (public.is_os_admin(tenant_id) or user_id = auth.uid());
create policy os_person_tax_address_update on public.os_person_tax_address
  for update to authenticated
  using (public.is_os_admin(tenant_id) or user_id = auth.uid())
  with check (public.is_os_admin(tenant_id) or user_id = auth.uid());
revoke all on public.os_person_tax_address from anon, authenticated;
grant select, insert, update on public.os_person_tax_address to authenticated;

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
-- work email, tax address (their own, or the shipping address when they say
-- it's the same; street, city and country at least), their tax ID in full (it's
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

  -- The tax address, or the shipping address when they're the same.
  select case when a.same_as_shipping then
           (select concat_ws(', ', s.line1, s.line2, s.city, s.region, s.postal_code, s.country_code)
              from public.os_person_shipping s
             where s.tenant_id = _t and s.user_id = _user and s.line1 is not null and s.city is not null and s.country_code is not null)
         when a.line1 is not null and a.city is not null and a.country_code is not null then
           concat_ws(', ', a.line1, a.line2, a.city, a.region, a.postal_code, a.country_code)
         end
    into _address
    from public.os_person_tax_address a where a.tenant_id = _t and a.user_id = _user;

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

  if _name is null then _missing := array_append(_missing, 'name'); end if;
  if _address is null then _missing := array_append(_missing, 'tax address'); end if;
  if _tax.type_key is null then _missing := array_append(_missing, 'tax ID'); end if;
  if _bank.account_last4 is null then _missing := array_append(_missing, 'bank details'); end if;

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
