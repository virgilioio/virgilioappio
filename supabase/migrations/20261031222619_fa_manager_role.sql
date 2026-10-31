-- Once (Allan, 2026-10-31): the F&A Manager commission role, and the won dates
-- of the two older hires' deals.
--
-- F&A Manager is held by Malena Garzón (malena@virgilio.tech): 7% of what
-- clients pay on Virgilio's services, every client, payable as Billing records
-- each payment. Retainers (engagement fees) are Virgilio's and never earn
-- commission. The rule runs from January 1, 2026, so Gio Sales can credit her
-- on every invoice issued so far. os-sync sends the role, with her email and
-- name, and then the rule to Gio Sales.
--
-- Catalyst Campaign Manager and Memberships Campaign Manager count as won on
-- the day their invoice was issued (INV-14 on May 7, INV-15 on May 22, 2026),
-- as in Gio Sales.

do $fa$
declare
  v_tenant constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  v_malena constant uuid := '0ae49a1f-38ad-4924-b6d1-70768bac6f34';
  c_job constant uuid := '88eb7f72-3f91-4c7a-a89f-7e7a8850599d';
  m_job constant uuid := 'f0d5173a-0bd2-4759-a09a-e007a66cb7b0';
  v_role uuid;
begin
  if exists (select 1 from public.os_commission_roles
              where tenant_id = v_tenant and (key = 'f_a_manager' or lower(label) = 'f&a manager')) then
    raise exception 'There is already an F&A Manager role; nothing changed.';
  end if;

  insert into public.os_commission_roles (tenant_id, label, description, person_source, position, holder_user_id)
  values (v_tenant, 'F&A Manager',
          'Virgilio''s Finance & Administration manager: a share of what clients pay on every invoice, retainers aside.',
          'named_person',
          (select coalesce(max(position), 0) + 1 from public.os_commission_roles where tenant_id = v_tenant),
          v_malena)
  returning id into v_role;

  insert into public.os_commission_rules (tenant_id, role_id, effective_from, basis, pct, payable_on, applies_to,
                                          fees, client, note)
  values (v_tenant, v_role, '2026-01-01', 'percent', 7, 'payment', 'services',
          array['success', 'ta-other', 'consulting', 'c-other'], 'any',
          '7% of all collected revenue, retainers aside (Allan, 2026-10-31).');

  update public.jobs set sales_deal_won_at = '2026-05-07' where id = c_job;
  update public.jobs set sales_deal_won_at = '2026-05-22' where id = m_job;
  if (select count(*) from public.jobs where id in (c_job, m_job)) <> 2 then
    raise exception 'A job is missing; nothing changed.';
  end if;
end $fa$;
