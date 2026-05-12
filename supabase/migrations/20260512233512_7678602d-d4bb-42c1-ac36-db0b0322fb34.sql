-- Helper: is the current user an admin-tier user in the given tenant?
create or replace function public.user_is_crm_admin_in_tenant(_tenant_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or _tenant_id is null then return false; end if;
  return exists (
    select 1 from public.members m
    where m.user_id = v_uid
      and m.tenant_id = _tenant_id
      and m.user_status = 'active'
      and (
        m.user_type in ('platform_admin','workspace_owner')
        or (m.user_type = 'member' and m.system_role = 'admin')
      )
  );
end $$;

-- deals
drop policy if exists "deals tenant select" on public.deals;
drop policy if exists "deals tenant insert" on public.deals;
drop policy if exists "deals tenant update" on public.deals;
drop policy if exists "deals tenant delete" on public.deals;

create policy "deals admin select" on public.deals
  for select using (public.user_is_crm_admin_in_tenant(tenant_id));
create policy "deals admin insert" on public.deals
  for insert with check (public.user_is_crm_admin_in_tenant(tenant_id));
create policy "deals admin update" on public.deals
  for update using (public.user_is_crm_admin_in_tenant(tenant_id))
  with check (public.user_is_crm_admin_in_tenant(tenant_id));
create policy "deals admin delete" on public.deals
  for delete using (public.user_is_crm_admin_in_tenant(tenant_id));

-- deal_stages
drop policy if exists "deal_stages tenant select" on public.deal_stages;
drop policy if exists "deal_stages tenant insert" on public.deal_stages;
drop policy if exists "deal_stages tenant update" on public.deal_stages;
drop policy if exists "deal_stages tenant delete" on public.deal_stages;

create policy "deal_stages admin select" on public.deal_stages
  for select using (public.user_is_crm_admin_in_tenant(tenant_id));
create policy "deal_stages admin insert" on public.deal_stages
  for insert with check (public.user_is_crm_admin_in_tenant(tenant_id));
create policy "deal_stages admin update" on public.deal_stages
  for update using (public.user_is_crm_admin_in_tenant(tenant_id))
  with check (public.user_is_crm_admin_in_tenant(tenant_id));
create policy "deal_stages admin delete" on public.deal_stages
  for delete using (public.user_is_crm_admin_in_tenant(tenant_id));

-- deal_payments
drop policy if exists "deal_payments tenant select" on public.deal_payments;
drop policy if exists "deal_payments tenant insert" on public.deal_payments;
drop policy if exists "deal_payments author update" on public.deal_payments;
drop policy if exists "deal_payments author delete" on public.deal_payments;

create policy "deal_payments admin select" on public.deal_payments
  for select using (public.user_is_crm_admin_in_tenant(tenant_id));
create policy "deal_payments admin insert" on public.deal_payments
  for insert with check (public.user_is_crm_admin_in_tenant(tenant_id));
create policy "deal_payments admin update" on public.deal_payments
  for update using (public.user_is_crm_admin_in_tenant(tenant_id))
  with check (public.user_is_crm_admin_in_tenant(tenant_id));
create policy "deal_payments admin delete" on public.deal_payments
  for delete using (public.user_is_crm_admin_in_tenant(tenant_id));