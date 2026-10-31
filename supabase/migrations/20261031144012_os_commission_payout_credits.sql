-- Commissions phase 2 (2026-10-31): which commissions each payout paid.
-- Gio Sales now sends `credit_ids` with every paid payout (its invoice credit
-- and lead credit ids, the same ids os_earnings keeps as sales_credit_id), so
-- the Earnings tab shows those as Paid and leaves them out of Payable: a
-- commission is earned once, when its payout is marked paid. A payout taken
-- back to approved keeps its ids but no longer counts (status approved).
--
-- Dry run (rolled back, 2026-10-31): a payout sent with two ids keeps both; the
-- same payout sent again without `credit_ids` (an older message) keeps them.

alter table public.os_commission_payouts
  add column sales_credit_ids uuid[] not null default '{}';

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

  insert into public.os_commission_payouts as p (
    tenant_id, sales_payout_id, user_id, person_name, person_email, month, currency, total, status,
    paid_on, lines, invoice_number, historical, note, sales_credit_ids, sales_sent_at)
  values (
    _t, (payload->>'payout_id')::uuid, _user, nullif(payload->>'member_name', ''), lower(nullif(payload->>'member_email', '')),
    (payload->>'month')::date, payload->>'currency', (payload->>'total')::numeric,
    case when payload->>'status' = 'paid' then 'paid' else 'approved' end,
    case when payload->>'status' = 'paid' then nullif(payload->>'paid_on', '')::date end,
    coalesce((payload->>'lines')::int, 0), nullif(payload->>'invoice_number', ''),
    coalesce((payload->>'historical')::boolean, false), nullif(payload->>'note', ''), coalesce(_ids, '{}'), _sent)
  on conflict (sales_payout_id) do update set
    user_id = excluded.user_id, person_name = excluded.person_name, person_email = excluded.person_email,
    month = excluded.month, currency = excluded.currency, total = excluded.total, status = excluded.status,
    paid_on = excluded.paid_on, lines = excluded.lines, invoice_number = excluded.invoice_number,
    historical = excluded.historical, note = excluded.note,
    -- An older message without ids keeps the ones already here.
    sales_credit_ids = case when _ids is null then p.sales_credit_ids else excluded.sales_credit_ids end,
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
