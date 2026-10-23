-- Commissions, piece 1: the rates move to Gio ATS (Allan, 2026-10-23).
--
-- Commission rates were kept in Gio Sales (commission_rates, Exhibit A): each
-- role's share of net collected revenue, with an effective date. Allan wants
-- them managed in Gio ATS, People & Access, with Gio Sales reading them. This
-- table is now where they're edited. Every new rate is delivered to Gio Sales
-- by os-sync (os-provision, kind 'commission_rate'), which keeps its own copy
-- so issuing an invoice never depends on the ATS being reachable.
--
-- Append-only, like the Gio Sales table: a change is a new row with a new
-- effective date; the latest date on or before a day wins. Rates are
-- Virgilio's only (Gio Sales is Virgilio's CRM). Everyone in the workspace
-- reads them (members will see how their earnings are worked out); People &
-- Access admins add them. Each one is recorded in the People & Access history.

create table public.os_commission_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id)
    check (tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'::uuid),
  role_key text not null check (role_key in ('sales_new', 'sales_existing', 'es', 'sp', 'tap')),
  pct numeric(5, 2) not null check (pct >= 0 and pct <= 100),
  effective_from date not null check (effective_from >= date '2020-01-01'),
  note text check (note is null or length(note) <= 300),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  -- Delivery to Gio Sales.
  sync_status text not null default 'pending' check (sync_status in ('pending', 'done', 'refused')),
  sync_error text check (sync_error is null or length(sync_error) <= 500),
  sync_attempts integer not null default 0,
  synced_at timestamptz,
  unique (tenant_id, role_key, effective_from)
);

comment on table public.os_commission_rates is
  'Commission rate per role (share of net collected revenue) with an effective date. Edited here, delivered to Gio Sales commission_rates by os-sync.';
comment on column public.os_commission_rates.role_key is
  'sales_new, sales_existing, es (Engagement Specialist), sp (Sourcing Partner), tap (TA Partner): the same keys as Gio Sales.';

create index os_commission_rates_pending on public.os_commission_rates (created_at) where sync_status = 'pending';

-- New rows are signed by whoever adds them and always start undelivered.
create or replace function public.os_commission_rates_validate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  new.created_by := auth.uid();
  new.created_at := now();
  new.note := nullif(btrim(new.note), '');
  new.sync_status := 'pending';
  new.sync_error := null;
  new.sync_attempts := 0;
  new.synced_at := null;
  return new;
end;
$function$;

create trigger os_commission_rates_validate
  before insert on public.os_commission_rates
  for each row execute function public.os_commission_rates_validate();

create or replace function public.os_commission_rates_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (new.tenant_id, auth.uid(), null, 'commission.rate_added',
          jsonb_build_object('role_key', new.role_key, 'pct', new.pct, 'effective_from', new.effective_from));
  return new;
end;
$function$;

create trigger os_commission_rates_audit
  after insert on public.os_commission_rates
  for each row execute function public.os_commission_rates_audit();

-- The rate in force for a role on a day (the latest effective date on or before it).
create or replace function public.os_commission_rate(_tenant_id uuid, _role_key text, _on date default current_date)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.pct from public.os_commission_rates r
  where r.tenant_id = _tenant_id and r.role_key = _role_key and r.effective_from <= _on
  order by r.effective_from desc
  limit 1;
$function$;

revoke all on function public.os_commission_rate(uuid, text, date) from public, anon;
grant execute on function public.os_commission_rate(uuid, text, date) to authenticated, service_role;

-- os-sync records Gio Sales' answer. Service role only.
create or replace function public.os_commission_rate_record(_id uuid, _ok boolean, _detail text, _retry boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.os_commission_rates
  set sync_attempts = sync_attempts + 1,
      sync_status = case when _ok then 'done' when _retry then 'pending' else 'refused' end,
      sync_error = case when _ok then null else left(_detail, 500) end,
      synced_at = case when _ok then now() else synced_at end
  where id = _id;
end;
$function$;

revoke all on function public.os_commission_rate_record(uuid, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.os_commission_rate_record(uuid, boolean, text, boolean) to service_role;

-- Row level security: read for the workspace, add for People & Access admins.
-- No update or removal: delivery fields change only through the function above.
alter table public.os_commission_rates enable row level security;

create policy os_commission_rates_read on public.os_commission_rates
  for select to authenticated
  using (public.is_os_admin(tenant_id) or public.user_has_active_tenant_membership(tenant_id));
create policy os_commission_rates_insert on public.os_commission_rates
  for insert to authenticated
  with check (public.is_os_admin(tenant_id));

-- New tables come with every privilege for signed-in users: narrow them to
-- reading and adding the rate's own fields.
revoke all on public.os_commission_rates from anon, authenticated;
grant select on public.os_commission_rates to authenticated;
grant insert (tenant_id, role_key, pct, effective_from, note) on public.os_commission_rates to authenticated;

-- Start from what Gio Sales has today (Exhibit A, from 2026-01-01). Gio Sales
-- already holds these, so they start delivered.
insert into public.os_commission_rates (tenant_id, role_key, pct, effective_from, note)
values
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'sales_new', 10, date '2026-01-01', 'Exhibit A standard allocation'),
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'sales_existing', 5, date '2026-01-01', 'Exhibit A standard allocation'),
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'es', 5, date '2026-01-01', 'Exhibit A standard allocation'),
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'sp', 10, date '2026-01-01', 'Exhibit A standard allocation'),
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'tap', 20, date '2026-01-01', 'Exhibit A standard allocation');

update public.os_commission_rates
set sync_status = 'done', synced_at = now()
where tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab' and effective_from = date '2026-01-01';
