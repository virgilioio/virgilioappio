-- Commissions phase 3 (2026-10-31): each member's commission portal on My
-- profile (Earnings: Overview, Commissions, Payouts, Invoices, Adjustments),
-- read only, for the member and People & Access admins. Allan agreed every
-- recommendation in the plan ("Gio Sales commissions module: plan", phase 3):
--   1. Draft payouts stay in Gio Sales; members see a payout once it's approved.
--   2. No Expected lines for members.
--   3. Proposed clawbacks stay in Gio Sales until Billing confirms them;
--      dismissed or removed adjustments leave the member's view.
--   4. The bell rings when a payout is approved or paid and when an adjustment
--      is added; an email goes out when it's paid or an adjustment is added.
--      Always on, like bank alerts.
--   5. Invoices stay in Gio Sales and open on a 5-minute link (functions).
--   6. The tax address is a profile check ("N of 8").
--
-- What changes here:
--   * os_commission_payouts keeps each payout's lines as they read on the
--     invoice (`items`), the invoice's issue and due dates, and whether Gio's
--     PDF and the member's own invoice are on it.
--   * os_commission_adjustments: a read-only copy of the adjustments a member
--     sees, kept by sales_commission_adjustment_upsert (Gio Sales'
--     commissions.adjustment event through sales-earnings).
--   * The bell (category account) and os_commission_alerts, the email queue
--     os-sync reads through os_commission_alerts_claim / _finish. A queue of its
--     own: os_bank_alerts' kinds can't widen without dropping its check.
--   * os_profile_missing adds 'tax_address': done when "Same as shipping
--     address" is on (or never touched) and the shipping address has a street,
--     a city and a country, or when its own address has them; Slack's profile
--     reminder counts 8.
--
-- Nothing is deleted or dropped.
--
-- Dry run (rolled back, 2026-10-31): Javier's payout approved rang one bell
-- ("Your October 2026 payout is approved | USD 1,800.00 · due Nov 5 ·
-- VIR-2026-0001") and queued no email; marked paid, a second bell and one
-- payout_paid email; a later message without lines kept its 2 lines and due
-- day; a bonus added rang "Bonus of USD 250.00 added to your pay" and queued
-- one email, its removal and a dismissed clawback stayed quiet; a past payout
-- sent again rang nothing; os_commission_alerts_claim handed both emails to
-- os-sync with Javier's address; os_profile_missing: Javier {you}, Allan {}
-- (both tax addresses complete through their shipping address).
-- slack_message_context matches the live definition except "of 8" (md5).

-- ── 1. Payouts: lines and invoice ──────────────────────────────────────────
alter table public.os_commission_payouts
  add column items jsonb not null default '[]'::jsonb,
  add column approved_on date,
  add column invoice_issued_on date,
  add column invoice_due_on date,
  add column has_invoice_pdf boolean not null default false,
  add column has_own_invoice boolean not null default false;

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
  _ids uuid[];
  _items jsonb;
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
  if jsonb_typeof(payload->'credit_ids') = 'array' then
    select coalesce(array_agg(v::uuid), '{}') into _ids from jsonb_array_elements_text(payload->'credit_ids') v;
  end if;
  -- Each line as it reads on the invoice: what it is, its words, its amount.
  if jsonb_typeof(payload->'items') = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'kind', i->>'kind', 'id', i->>'id',
             'description', left(coalesce(i->>'description', ''), 500),
             'amount', (i->>'amount')::numeric)), '[]'::jsonb)
      into _items from jsonb_array_elements(payload->'items') i;
  end if;

  insert into public.os_commission_payouts as p (
    tenant_id, sales_payout_id, user_id, person_name, person_email, month, currency, total, status,
    paid_on, lines, invoice_number, historical, note, sales_credit_ids, items, approved_on,
    invoice_issued_on, invoice_due_on, has_invoice_pdf, has_own_invoice, sales_sent_at)
  values (
    _t, (payload->>'payout_id')::uuid, _user, nullif(payload->>'member_name', ''), lower(nullif(payload->>'member_email', '')),
    (payload->>'month')::date, payload->>'currency', (payload->>'total')::numeric,
    case when payload->>'status' = 'paid' then 'paid' else 'approved' end,
    case when payload->>'status' = 'paid' then nullif(payload->>'paid_on', '')::date end,
    coalesce((payload->>'lines')::int, 0), nullif(payload->>'invoice_number', ''),
    coalesce((payload->>'historical')::boolean, false), nullif(payload->>'note', ''), coalesce(_ids, '{}'),
    coalesce(_items, '[]'::jsonb), nullif(payload->>'approved_on', '')::date,
    nullif(payload->>'invoice_issued_on', '')::date, nullif(payload->>'invoice_due_on', '')::date,
    coalesce((payload->>'has_invoice_pdf')::boolean, false), coalesce((payload->>'has_own_invoice')::boolean, false), _sent)
  on conflict (sales_payout_id) do update set
    user_id = excluded.user_id, person_name = excluded.person_name, person_email = excluded.person_email,
    month = excluded.month, currency = excluded.currency, total = excluded.total, status = excluded.status,
    paid_on = excluded.paid_on, lines = excluded.lines, invoice_number = excluded.invoice_number,
    historical = excluded.historical, note = excluded.note,
    -- An older message without ids or lines keeps the ones already here.
    sales_credit_ids = case when _ids is null then p.sales_credit_ids else excluded.sales_credit_ids end,
    items = case when _items is null then p.items else excluded.items end,
    approved_on = coalesce(excluded.approved_on, p.approved_on),
    invoice_issued_on = coalesce(excluded.invoice_issued_on, p.invoice_issued_on),
    invoice_due_on = coalesce(excluded.invoice_due_on, p.invoice_due_on),
    has_invoice_pdf = case when payload ? 'has_invoice_pdf' then excluded.has_invoice_pdf else p.has_invoice_pdf end,
    has_own_invoice = case when payload ? 'has_own_invoice' then excluded.has_own_invoice else p.has_own_invoice end,
    sales_sent_at = excluded.sales_sent_at, updated_at = now()
  where p.sales_sent_at <= excluded.sales_sent_at;

  _res := jsonb_build_object('ok', true, 'payout', payload->>'payout_id', 'status', payload->>'status');
  insert into public.integration_inbox (idempotency_key, endpoint, status_code, response)
  values (_key, 'sales-earnings', 200, _res)
  on conflict (idempotency_key) do nothing;
  return _res;
end $$;
revoke execute on function public.sales_commission_payout_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.sales_commission_payout_upsert(jsonb) to service_role;

-- ── 2. Adjustments ─────────────────────────────────────────────────────────
create table public.os_commission_adjustments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sales_adjustment_id uuid not null unique,
  user_id uuid references auth.users(id) on delete set null,
  person_name text,
  person_email text,
  kind text not null check (kind in ('bonus', 'correction', 'clawback', 'other', 'carry_over')),
  -- Positive adds to their pay, negative deducts.
  amount numeric(14, 2) not null,
  currency text not null,
  -- As Billing wrote it; the member always sees it.
  reason text not null,
  -- The payout month it belongs to.
  month date not null,
  -- active: on their pay; removed: removed or dismissed in Gio Sales (no longer shown).
  status text not null check (status in ('active', 'removed')),
  sales_payout_id uuid,
  added_at timestamptz not null,
  sales_sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index os_commission_adjustments_user on public.os_commission_adjustments (tenant_id, user_id, added_at desc);
alter table public.os_commission_adjustments enable row level security;
-- The member reads their own; People & Access admins read everyone's. Nobody writes from the browser.
create policy os_commission_adjustments_read on public.os_commission_adjustments for select
  using (user_id = auth.uid() or public.is_os_admin(tenant_id));
revoke all on public.os_commission_adjustments from anon, authenticated;
grant select on public.os_commission_adjustments to authenticated;

create or replace function public.sales_commission_adjustment_upsert(payload jsonb)
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
  if _key is null or nullif(payload->>'adjustment_id', '') is null then raise exception 'idempotency_key and adjustment_id are required'; end if;
  select response into _prior from public.integration_inbox where idempotency_key = _key;
  if found then return _prior; end if;

  _user := nullif(payload->>'ats_user_id', '')::uuid;
  if _user is null or not exists (select 1 from public.members m where m.tenant_id = _t and m.user_id = _user) then
    select u.id into _user
      from auth.users u join public.members m on m.user_id = u.id and m.tenant_id = _t
     where lower(u.email) = lower(btrim(payload->>'member_email'))
     limit 1;
  end if;

  insert into public.os_commission_adjustments as a (
    tenant_id, sales_adjustment_id, user_id, person_name, person_email, kind, amount, currency, reason,
    month, status, sales_payout_id, added_at, sales_sent_at)
  values (
    _t, (payload->>'adjustment_id')::uuid, _user, nullif(payload->>'member_name', ''), lower(nullif(payload->>'member_email', '')),
    payload->>'kind', (payload->>'amount')::numeric, payload->>'currency', left(coalesce(payload->>'reason', ''), 500),
    (payload->>'month')::date,
    case when payload->>'status' = 'active' then 'active' else 'removed' end,
    nullif(payload->>'payout_id', '')::uuid,
    coalesce(nullif(payload->>'added_at', '')::timestamptz, _sent), _sent)
  on conflict (sales_adjustment_id) do update set
    user_id = excluded.user_id, person_name = excluded.person_name, person_email = excluded.person_email,
    kind = excluded.kind, amount = excluded.amount, currency = excluded.currency, reason = excluded.reason,
    month = excluded.month, status = excluded.status, sales_payout_id = excluded.sales_payout_id,
    sales_sent_at = excluded.sales_sent_at, updated_at = now()
  where a.sales_sent_at <= excluded.sales_sent_at;

  _res := jsonb_build_object('ok', true, 'adjustment', payload->>'adjustment_id', 'status', payload->>'status');
  insert into public.integration_inbox (idempotency_key, endpoint, status_code, response)
  values (_key, 'sales-earnings', 200, _res)
  on conflict (idempotency_key) do nothing;
  return _res;
end $$;
revoke execute on function public.sales_commission_adjustment_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.sales_commission_adjustment_upsert(jsonb) to service_role;

-- ── 3. The bell and the email ──────────────────────────────────────────────
-- What os-sync emails: a payout marked paid, an adjustment added. Read by the
-- server only (no policies).
create table public.os_commission_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('payout_paid', 'adjustment_added')),
  -- What the email says: month, amount, currency, paid on, invoice number, kind, reason.
  detail jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.os_commission_alerts enable row level security;
revoke all on public.os_commission_alerts from anon, authenticated;

-- "USD 1,800.00", "-USD 150.00"
create or replace function public.os_money_text(_amount numeric, _currency text)
returns text
language sql
immutable
set search_path = 'public'
as $$
  select case when _amount < 0 then '-' else '' end || _currency || ' ' || to_char(abs(_amount), 'FM999,999,999,990.00')
$$;

create or replace function public.os_commission_payouts_z_notify()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  _month text := to_char(new.month, 'FMMonth YYYY');
  _money text := public.os_money_text(new.total, new.currency);
begin
  -- Past payouts recorded from before Commissions never ring.
  if new.user_id is null or new.historical then return null; end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') and (tg_op = 'INSERT' or old.status <> 'paid') then
    insert into public.notifications (user_id, tenant_id, category, title, subtitle, action_url, entity_kind, metadata)
    values (new.user_id, new.tenant_id, 'account'::public.notification_category,
            'Your ' || _month || ' payout is approved',
            _money || coalesce(' · due ' || to_char(new.invoice_due_on, 'FMMon FMDD'), '') || coalesce(' · ' || new.invoice_number, ''),
            '/me?tab=earnings&view=payouts&payout=' || new.id, 'commission_payout',
            jsonb_build_object('source', 'commissions', 'payout_id', new.id));
  elsif new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    insert into public.notifications (user_id, tenant_id, category, title, subtitle, action_url, entity_kind, metadata)
    values (new.user_id, new.tenant_id, 'account'::public.notification_category,
            'Your ' || _month || ' payout is paid',
            _money || coalesce(' · paid ' || to_char(new.paid_on, 'FMMon FMDD'), ''),
            '/me?tab=earnings&view=payouts&payout=' || new.id, 'commission_payout',
            jsonb_build_object('source', 'commissions', 'payout_id', new.id));
    insert into public.os_commission_alerts (tenant_id, user_id, kind, detail)
    values (new.tenant_id, new.user_id, 'payout_paid', jsonb_build_object(
      'payout_id', new.id, 'month', _month, 'amount', _money, 'paid_on', new.paid_on,
      'invoice_number', new.invoice_number));
  end if;
  return null;
end $$;
create trigger os_commission_payouts_z_notify
  after insert or update of status on public.os_commission_payouts
  for each row execute function public.os_commission_payouts_z_notify();

create or replace function public.os_commission_adjustments_z_notify()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  _kind text := case new.kind when 'carry_over' then 'Carried over' else initcap(new.kind) end;
  _money text := public.os_money_text(new.amount, new.currency);
begin
  -- Only an adjustment that arrives on their pay; a removal or a later edit is quiet.
  if new.user_id is null or new.status <> 'active' then return null; end if;
  insert into public.notifications (user_id, tenant_id, category, title, subtitle, action_url, entity_kind, metadata)
  values (new.user_id, new.tenant_id, 'account'::public.notification_category,
          _kind || ' of ' || _money || ' added to your pay',
          left(new.reason, 140),
          '/me?tab=earnings&view=adjustments', 'commission_adjustment',
          jsonb_build_object('source', 'commissions', 'adjustment_id', new.id));
  insert into public.os_commission_alerts (tenant_id, user_id, kind, detail)
  values (new.tenant_id, new.user_id, 'adjustment_added', jsonb_build_object(
    'adjustment_id', new.id, 'kind', _kind, 'amount', _money, 'reason', new.reason,
    'month', to_char(new.month, 'FMMonth YYYY')));
  return null;
end $$;
create trigger os_commission_adjustments_z_notify
  after insert on public.os_commission_adjustments
  for each row execute function public.os_commission_adjustments_z_notify();

-- os-sync claims waiting emails and settles each one, as with bank alerts.
create or replace function public.os_commission_alerts_claim(_limit integer default 20)
returns table (alert_id uuid, kind text, to_email text, person_name text, detail jsonb, created_at timestamptz)
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  return query
  with picked as (
    select a.id from public.os_commission_alerts a
    where a.status = 'pending' and a.attempts < 5
      and (a.claimed_at is null or a.claimed_at < now() - interval '10 minutes')
    order by a.created_at
    limit greatest(1, least(_limit, 100))
    for update skip locked
  ), upd as (
    update public.os_commission_alerts a set claimed_at = now(), attempts = a.attempts + 1
    from picked where a.id = picked.id
    returning a.*
  )
  select upd.id, upd.kind, u.email::text,
    nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
    upd.detail, upd.created_at
  from upd
  join auth.users u on u.id = upd.user_id
  left join public.profiles p on p.user_id = upd.user_id;
end $$;

create or replace function public.os_commission_alerts_finish(_id uuid, _ok boolean, _error text default null)
returns void
language sql
security definer
set search_path = 'public'
as $$
  update public.os_commission_alerts set
    status = case when _ok then 'sent' when attempts >= 5 then 'failed' else 'pending' end,
    sent_at = case when _ok then now() end,
    claimed_at = case when _ok then claimed_at end,
    last_error = case when _ok then null else left(_error, 480) end
  where id = _id;
$$;
revoke execute on function public.os_commission_alerts_claim(integer) from public, anon, authenticated;
revoke execute on function public.os_commission_alerts_finish(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.os_commission_alerts_claim(integer), public.os_commission_alerts_finish(uuid, boolean, text) to service_role;
revoke execute on function public.os_commission_payouts_z_notify() from public, anon, authenticated;
revoke execute on function public.os_commission_adjustments_z_notify() from public, anon, authenticated;

-- ── 4. The tax address is a profile check ──────────────────────────────────
create or replace function public.os_profile_missing(_tenant uuid, _user uuid)
 returns text[]
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select array_remove(array[
    case when coalesce(p.avatar_url, '') = '' or coalesce(btrim(p.title), '') = '' then 'you' end,
    case when not exists (select 1 from public.user_mail_identities u where u.user_id = _user)
              and not exists (select 1 from public.calendar_identities c where c.user_id = _user)
           or exists (select 1 from public.user_mail_identities u
                      where u.user_id = _user and public.os_google_broken(u.is_active, u.sync_status, u.sync_error))
           or exists (select 1 from public.calendar_identities c
                      where c.user_id = _user and public.os_google_broken(c.is_active, c.sync_status, c.sync_error_message))
         then 'google' end,
    case when d.country_code is null or coalesce(btrim(d.personal_email), '') = ''
           or coalesce(btrim(d.personal_phone), '') = '' then 'personal' end,
    case when d.birth_date is null then 'birthday' end,
    case when not exists (select 1 from public.os_person_tax_ids t
                          where t.tenant_id = _tenant and t.user_id = _user and t.removed_at is null) then 'tax' end,
    case when not exists (select 1 from public.os_person_bank b
                          where b.tenant_id = _tenant and b.user_id = _user) then 'bank' end,
    case when coalesce(btrim(s.line1), '') = '' or coalesce(btrim(s.city), '') = ''
           or s.country_code is null then 'shipping' end,
    -- The address on their commission invoices: the shipping address while
    -- "Same as shipping address" is on (the default), or its own.
    case when coalesce(ta.same_as_shipping, true)
           then case when coalesce(btrim(s.line1), '') = '' or coalesce(btrim(s.city), '') = ''
                       or s.country_code is null then 'tax_address' end
           else case when coalesce(btrim(ta.line1), '') = '' or coalesce(btrim(ta.city), '') = ''
                       or ta.country_code is null then 'tax_address' end
         end
  ], null)
  from (select 1) one
  left join public.profiles p on p.user_id = _user
  left join public.os_person_details d on d.tenant_id = _tenant and d.user_id = _user
  left join public.os_person_shipping s on s.tenant_id = _tenant and s.user_id = _user
  left join public.os_person_tax_address ta on ta.tenant_id = _tenant and ta.user_id = _user;
$function$;

-- Slack's profile reminder: "N of 8 done" (the live definition, with only that line changed).
CREATE OR REPLACE FUNCTION public.slack_message_context(_ctx jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  res jsonb := '{}'::jsonb;
  _job uuid := nullif(_ctx ->> 'job_id', '')::uuid;
  assoc uuid := nullif(_ctx ->> 'association_id', '')::uuid;
  opening record;
  req uuid := nullif(_ctx ->> 'request_id', '')::uuid;
  turn_step uuid := nullif(_ctx ->> 'turn_step_id', '')::uuid;
  chain_mode text;
  cur record;
  member_user uuid := nullif(_ctx ->> 'member_user_id', '')::uuid;
  member_tenant uuid;
  miss text[];
  waited interval;
begin
  res := res || jsonb_build_object('candidate', (
    select jsonb_build_object('id', c.id, 'name', coalesce(nullif(trim(c.candidate_name), ''), 'Unnamed candidate'))
    from public.candidates c where c.id = nullif(_ctx ->> 'candidate_id', '')::uuid));
  res := res || jsonb_build_object('job', (
    select jsonb_build_object('id', j.id, 'title', j.title, 'client', o.name, 'department', d.name)
    from public.jobs j
    left join public.organizations o on o.id = j.organization_id
    left join public.departments d on d.id = j.department_id
    where j.id = _job));
  res := res || jsonb_build_object('stage', (
    select coalesce(nullif(h.custom_stage_name, ''), s.stage_name)
    from public.job_hiring_stages h left join public.job_stages s on s.id = h.stage_id
    where h.id = nullif(_ctx ->> 'stage_id', '')::uuid));
  res := res || jsonb_build_object('from_stage', (
    select coalesce(nullif(h.custom_stage_name, ''), s.stage_name)
    from public.job_hiring_stages h left join public.job_stages s on s.id = h.stage_id
    where h.id = nullif(_ctx ->> 'from_stage_id', '')::uuid));
  res := res || jsonb_build_object('actor',
    case when coalesce((_ctx ->> 'by_gio')::boolean, false) then null
         else public.slack_person(nullif(_ctx ->> 'actor_id', '')::uuid) end);
  res := res || jsonb_build_object('reason', (
    select r.name from public.rejection_reasons r where r.id = nullif(_ctx ->> 'reason_id', '')::uuid));

  -- The job's people; a hire names who it credits.
  select o.req_id, o.sourcer_user_id, o.recruiter_user_id into opening
  from public.job_openings o
  where (assoc is not null and o.hired_association_id = assoc)
     or o.id = nullif(_ctx ->> 'opening_id', '')::uuid
  limit 1;
  res := res || jsonb_build_object(
    'opening', opening.req_id,
    'recruiters', coalesce(
      case when opening.recruiter_user_id is not null then jsonb_build_array(public.slack_person(opening.recruiter_user_id)) end,
      (select jsonb_agg(public.slack_person(a.user_id)) from public.job_assignments a
        where a.job_id = _job and a.role = 'recruiter' and a.deleted_at is null), '[]'::jsonb),
    'sourcers', coalesce(
      case when opening.sourcer_user_id is not null then jsonb_build_array(public.slack_person(opening.sourcer_user_id)) end,
      (select jsonb_agg(public.slack_person(a.user_id)) from public.job_assignments a
        where a.job_id = _job and a.role = 'sourcer' and a.deleted_at is null), '[]'::jsonb),
    'hiring_managers', coalesce(
      (select jsonb_agg(public.slack_person(a.user_id)) from public.job_assignments a
        where a.job_id = _job and a.role = 'hiring_manager' and a.deleted_at is null), '[]'::jsonb));

  if nullif(_ctx ->> 'booking_id', '') is not null then
    res := res || (
      select jsonb_build_object(
        'interviewer', public.slack_person(b.interviewer_id),
        'interview_start', b.scheduled_start,
        'interview_title', b.event_title)
      from public.scheduled_bookings b where b.id = (_ctx ->> 'booking_id')::uuid);
  end if;
  -- A scorecard reminder is for the person who owes it (an attendee too).
  if nullif(_ctx ->> 'interviewer_user_id', '') is not null then
    res := res || jsonb_build_object('interviewer', public.slack_person((_ctx ->> 'interviewer_user_id')::uuid));
  end if;
  if nullif(_ctx ->> 'scorecard_id', '') is not null then
    res := res || (
      select jsonb_build_object('rating', s.rating::text)
      from public.job_stage_scorecards s where s.id = (_ctx ->> 'scorecard_id')::uuid);
  end if;
  -- An offer approval: whose turn it is (this step's approver when the
  -- message is their turn; else whoever's turn it is now), "Step 2 of 3" and,
  -- for a turn, how long it has waited.
  if req is not null then
    select coalesce(c.mode, 'sequential') into chain_mode
    from public.offer_approval_requests q
    left join public.offer_approval_chains c on c.job_id = q.job_id
    where q.id = req;
    select coalesce(jsonb_agg(public.slack_person(s.approver_user_id) order by s.step_order), '[]'::jsonb) as people,
           count(*) as n, min(s.step_order) as step_order
    into cur
    from public.offer_approval_request_steps s
    where s.request_id = req
      and case when turn_step is not null then s.id = turn_step
               else s.status = 'pending'
                 and (chain_mode = 'parallel'
                      or s.step_order = (select min(x.step_order) from public.offer_approval_request_steps x
                                         where x.request_id = req and x.status = 'pending')) end;
    res := res || jsonb_build_object(
      'turn', turn_step is not null,
      'approvers', cur.people,
      'approval_step', case when cur.n = 1 then (
        select 'Step ' || count(*) filter (where x.step_order <= cur.step_order) || ' of ' || count(*)
        from public.offer_approval_request_steps x
        where x.request_id = req and x.status <> 'skipped') end);
    if turn_step is not null then
      waited := now() - public.offer_approval_turn_started(turn_step);
      res := res || jsonb_build_object('waiting', case
        when waited is null then null
        when waited >= interval '2 days' then floor(extract(epoch from waited) / 86400)::int || ' days'
        when waited >= interval '1 day' then '1 day'
        when waited >= interval '2 hours' then floor(extract(epoch from waited) / 3600)::int || ' hours'
        when waited >= interval '1 hour' then '1 hour'
        else 'less than an hour' end);
    end if;
  end if;
  -- People: who it's about, and what their profile still needs (the names of
  -- the cards, never anything in them).
  if member_user is not null then
    select m.tenant_id into member_tenant from public.members m where m.id = nullif(_ctx ->> 'member_id', '')::uuid;
    miss := public.os_profile_missing(member_tenant, member_user);
    res := res || jsonb_build_object(
      'member', public.slack_person(member_user),
      'missing', to_jsonb(miss),
      'progress', (8 - cardinality(miss)) || ' of 8 done',
      'link', '/me');
  end if;
  return res;
end;
$function$;
