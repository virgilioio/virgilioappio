-- Earnings from Gio Sales (Allan, 2026-10-23, commissions piece 3). Gio Sales
-- issues and collects the invoices. Each invoice credits people (Sales and
-- Engagement Specialist from the deal, the hire's Sourcer and Recruiter) with a
-- share of its net amount. Gio Sales now sends those credits here every time
-- the invoice changes (issued, partly paid, paid, voided), and they become one
-- row per person per invoice:
--   earned  = share x what the client has paid so far
--   pending = share x what is still to be paid on an issued invoice
-- Amounts stay in the invoice's currency. Gio Sales does the maths. This table
-- only keeps what it sent. A person sees their own rows. People & Access
-- admins see everyone's. Only the service role writes.

create table public.os_earnings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  sales_credit_id uuid not null unique,
  sales_request_id uuid not null,
  request_number text not null,
  invoice_number text,
  client_name text,
  deal_title text,
  -- Plain ids, so removing a job, an opening or a user never waits on earnings.
  opening_id uuid,
  job_id uuid,
  user_id uuid,
  person_name text,
  person_email text,
  role_key text not null check (role_key in ('sales_new', 'sales_existing', 'es', 'sp', 'tap')),
  role_label text not null,
  share_pct numeric(7, 4) not null check (share_pct >= 0 and share_pct <= 100),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  invoice_amount numeric(14, 2) not null,
  collected_amount numeric(14, 2) not null default 0,
  earned_amount numeric(14, 2) not null default 0,
  pending_amount numeric(14, 2) not null default 0,
  status text not null check (status in ('issued', 'partly_paid', 'paid', 'void')),
  void_reason text,
  issued_on date,
  paid_on date,
  sales_sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index os_earnings_user on public.os_earnings (user_id, status);
create index os_earnings_request on public.os_earnings (sales_request_id);
create index os_earnings_opening on public.os_earnings (opening_id);

comment on table public.os_earnings is 'Commission earnings per person per invoice, sent by Gio Sales (sales-earnings). Read only for the app.';

alter table public.os_earnings enable row level security;
revoke all on public.os_earnings from anon, authenticated;
grant select on public.os_earnings to authenticated;

create policy os_earnings_read on public.os_earnings
  for select to authenticated
  using (user_id = auth.uid() or public.is_os_admin(tenant_id));

-- What Gio Sales sends for one invoice: the invoice and every credit on it.
-- Credits no longer on the invoice (re-issued with new credits) are voided here.
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
    -- The Sourcer and Recruiter come with their Gio ATS id. Sales and the
    -- Engagement Specialist are matched by email to a member of Virgilio.
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
      invoice_amount, collected_amount, earned_amount, pending_amount, status, void_reason, issued_on, paid_on, sales_sent_at)
    values (
      _t, (_c->>'id')::uuid, _rid, _r->>'number', nullif(_r->>'invoice_number', ''), nullif(_r->>'client_name', ''), nullif(_r->>'deal_title', ''),
      _opening, _job, _user, nullif(_c->>'person_name', ''), nullif(_c->>'person_email', ''), _c->>'role_key', _c->>'role_label',
      (_c->>'share_pct')::numeric, _r->>'currency',
      (_r->>'amount')::numeric, (_r->>'paid_amount')::numeric, (_c->>'earned_amount')::numeric, (_c->>'pending_amount')::numeric,
      _r->>'status', case when _r->>'status' = 'void' then 'Invoice voided in Gio Sales' end,
      (_r->>'issued_on')::date, (_r->>'paid_on')::date, _sent)
    on conflict (sales_credit_id) do update set
      request_number = excluded.request_number, invoice_number = excluded.invoice_number,
      client_name = excluded.client_name, deal_title = excluded.deal_title,
      opening_id = excluded.opening_id, job_id = excluded.job_id, user_id = excluded.user_id,
      person_name = excluded.person_name, person_email = excluded.person_email,
      role_key = excluded.role_key, role_label = excluded.role_label, share_pct = excluded.share_pct,
      currency = excluded.currency, invoice_amount = excluded.invoice_amount, collected_amount = excluded.collected_amount,
      earned_amount = excluded.earned_amount, pending_amount = excluded.pending_amount,
      status = excluded.status, void_reason = excluded.void_reason,
      issued_on = excluded.issued_on, paid_on = excluded.paid_on, sales_sent_at = excluded.sales_sent_at, updated_at = now()
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
