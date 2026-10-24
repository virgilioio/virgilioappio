-- Tax ID changes by someone else are emailed too (Allan, 2026-10-24), the way
-- bank details changes are. os_bank_alerts carries a kind ('bank', the old
-- rows, or 'tax_id_changed' / 'tax_id_removed' with the ID's label), the bell
-- function queues one, and os-sync claims them all through
-- os_account_alerts_claim. os_bank_alerts_claim keeps its shape and now
-- claims bank alerts only, so an os-sync that hasn't been redeployed yet never
-- sends a tax ID change as a bank email. The email shows the label only,
-- never any part of the number. Links now open My profile's details
-- (/me/details), where the bank and tax ID cards live.

alter table public.os_bank_alerts
  add column kind text not null default 'bank'
    check (kind in ('bank', 'tax_id_changed', 'tax_id_removed')),
  add column label text check (label is null or length(label) <= 60);

comment on table public.os_bank_alerts is
  'Changes to a person''s bank details or tax IDs made by someone else, waiting to be emailed to them by os-sync (the bell rang at once).';

-- The old claim, bank alerts only.
create or replace function public.os_bank_alerts_claim(_limit int default 20)
returns table(alert_id uuid, to_email text, person_name text, changed_by_name text, changed_at timestamptz,
              bank_name text, account_label text, account_last4 text)
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
begin
  return query
  with picked as (
    select a.id from public.os_bank_alerts a
    where a.status = 'pending' and a.attempts < 5 and a.kind = 'bank'
      and (a.claimed_at is null or a.claimed_at < now() - interval '10 minutes')
    order by a.created_at
    limit greatest(1, least(_limit, 100))
    for update skip locked
  ), upd as (
    update public.os_bank_alerts a set claimed_at = now(), attempts = a.attempts + 1
    from picked where a.id = picked.id
    returning a.*
  )
  select upd.id, u.email::text,
    nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
    nullif(btrim(coalesce(cp.first_name, '') || ' ' || coalesce(cp.last_name, '')), ''),
    upd.created_at, b.bank_name, b.account_label, b.account_last4
  from upd
  join auth.users u on u.id = upd.user_id
  left join public.profiles p on p.user_id = upd.user_id
  left join public.profiles cp on cp.user_id = upd.changed_by
  left join public.os_person_bank b on b.tenant_id = upd.tenant_id and b.user_id = upd.user_id;
end;
$function$;

-- Every kind, for os-sync. Same claim rules: ten minutes, five tries.
create or replace function public.os_account_alerts_claim(_limit int default 20)
returns table(alert_id uuid, kind text, label text, to_email text, person_name text, changed_by_name text,
              changed_at timestamptz, bank_name text, account_label text, account_last4 text)
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
begin
  return query
  with picked as (
    select a.id from public.os_bank_alerts a
    where a.status = 'pending' and a.attempts < 5
      and (a.claimed_at is null or a.claimed_at < now() - interval '10 minutes')
    order by a.created_at
    limit greatest(1, least(_limit, 100))
    for update skip locked
  ), upd as (
    update public.os_bank_alerts a set claimed_at = now(), attempts = a.attempts + 1
    from picked where a.id = picked.id
    returning a.*
  )
  select upd.id, upd.kind, upd.label, u.email::text,
    nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
    nullif(btrim(coalesce(cp.first_name, '') || ' ' || coalesce(cp.last_name, '')), ''),
    upd.created_at,
    case when upd.kind = 'bank' then b.bank_name end,
    case when upd.kind = 'bank' then b.account_label end,
    case when upd.kind = 'bank' then b.account_last4 end
  from upd
  join auth.users u on u.id = upd.user_id
  left join public.profiles p on p.user_id = upd.user_id
  left join public.profiles cp on cp.user_id = upd.changed_by
  left join public.os_person_bank b on b.tenant_id = upd.tenant_id and b.user_id = upd.user_id;
end;
$function$;
revoke all on function public.os_account_alerts_claim(int) from public, anon, authenticated;
grant execute on function public.os_account_alerts_claim(int) to service_role;

-- The bell, now with the email queued beside it.
create or replace function public.os_tax_id_bell(_tenant_id uuid, _user_id uuid, _label text, _removed boolean)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  who text;
begin
  if auth.uid() is null or auth.uid() = _user_id then return; end if;
  select nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '') into who
  from public.profiles p where p.user_id = auth.uid();
  insert into public.notifications (user_id, tenant_id, category, actor_user_id, actor_name, title, subtitle,
                                    entity_kind, entity_id, action_url, metadata)
  values (_user_id, _tenant_id, 'account'::public.notification_category, auth.uid(), who,
          case when _removed then 'Your ' || _label || ' was removed' else 'Your ' || _label || ' was changed' end,
          coalesce(who, 'An admin') || case when _removed then ' removed it from your profile.' else ' updated it on your profile.' end,
          'person', _user_id, '/me/details',
          jsonb_build_object('kind', case when _removed then 'tax_id_removed' else 'tax_id_changed' end));
  insert into public.os_bank_alerts (tenant_id, user_id, changed_by, kind, label)
  values (_tenant_id, _user_id, auth.uid(), case when _removed then 'tax_id_removed' else 'tax_id_changed' end, left(_label, 60));
end;
$function$;
revoke all on function public.os_tax_id_bell(uuid, uuid, text, boolean) from public, anon, authenticated;
