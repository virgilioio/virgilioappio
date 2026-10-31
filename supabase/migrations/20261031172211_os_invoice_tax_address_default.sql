-- Commission invoices: no tax address row means "Same as shipping address"
-- (2026-10-31).
--
-- Approving Allan's October payout in Gio Sales was refused with "needs to add
-- their tax address", though his shipping address is complete and My profile
-- shows the check as done. os_member_invoice_details read the address only
-- from an os_person_tax_address row; a member who never touched the Tax
-- address card has none, and the card's default is "Same as shipping
-- address". It now reads a missing row as that default, the same rule as
-- os_profile_missing. Nothing else in the function changes; its grants
-- (service_role only) stay as they are.

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

  -- The tax address, or the shipping address when they're the same. No row yet
  -- means "Same as shipping address", the card's default, as os_profile_missing
  -- and My profile read it (2026-10-31: a member who never touched the card was
  -- refused for a missing tax address).
  select case when coalesce(a.same_as_shipping, true) then
           (select concat_ws(', ', s.line1, s.line2, s.city, s.region, s.postal_code, s.country_code)
              from public.os_person_shipping s
             where s.tenant_id = _t and s.user_id = _user and s.line1 is not null and s.city is not null and s.country_code is not null)
         when a.line1 is not null and a.city is not null and a.country_code is not null then
           concat_ws(', ', a.line1, a.line2, a.city, a.region, a.postal_code, a.country_code)
         end
    into _address
    from (select 1) one
    left join public.os_person_tax_address a on a.tenant_id = _t and a.user_id = _user;

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
