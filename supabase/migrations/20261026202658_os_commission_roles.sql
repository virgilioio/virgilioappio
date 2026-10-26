-- Commissions, step 1: roles and rules as configuration (Allan, 2026-10-26).
--
-- Commission rates were five fixed roles, each "x% of what Virgilio collects".
-- Allan wants roles and rules anyone with admin rights can create and change,
-- so new roles (SDR, Partner Originator, and whatever comes next) never need
-- code. This adds:
--
-- 1. os_commission_roles: a role (label, description, on or off) and where its
--    person comes from on a deal. The places are fixed, roles are not:
--    deal_sales, deal_es and deal_sdr (picked on the deal in Gio Sales),
--    partner_owner (the partner's owner when the partner joins the deal),
--    hire_sourcer and hire_recruiter (from the hire in Gio ATS).
-- 2. os_commission_rules: what a role is paid. Append-only, like rates: a
--    change is a new version of the rule (same series_id) from a later date,
--    and a version with stopped = true ends it. A rule says:
--    - pays: a percent of what is paid, or a fixed amount in a currency;
--    - when it is payable: as Billing records each payment, or when a partner
--      lead is marked accepted (fixed amounts on partner items only);
--    - on what: Virgilio's services (all, or some fees; new, existing or any
--      client) or partner items (fixed, recurring or any);
--    - for how long: always, or N months from the first paid invoice for that
--      client.
-- 3. The five existing roles move over as built-in roles, each with one rule
--    holding today's rate. Until Gio Sales reads rules (step 2), a built-in
--    role keeps that one rule: a new version changes its rate and is copied
--    into os_commission_rates, which os-sync already delivers to Gio Sales.
-- 4. Two new roles with Allan's rules from 2026-10-26: SDR (USD 100 when a
--    partner accepts the lead, on fixed partner items) and Partner Originator
--    (10% of what partners pay on recurring items, for 12 months per client).
--    Gio Sales starts using them in step 2.
--
-- People & Access admins create and change roles and rules; the workspace
-- reads them. Every change is in the People & Access history.

-- ── 1. Roles ──────────────────────────────────────────────────────────────
create table public.os_commission_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id)
    check (tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'::uuid),
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  description text check (description is null or char_length(description) <= 300),
  person_source text not null check (person_source in
    ('deal_sales', 'deal_es', 'deal_sdr', 'partner_owner', 'hire_sourcer', 'hire_recruiter')),
  built_in boolean not null default false,
  active boolean not null default true,
  position integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Delivery to Gio Sales (step 2).
  sync_status text not null default 'pending' check (sync_status in ('pending', 'done', 'refused')),
  sync_error text check (sync_error is null or length(sync_error) <= 500),
  sync_attempts integer not null default 0,
  synced_at timestamptz,
  unique (tenant_id, key)
);
create unique index os_commission_roles_label on public.os_commission_roles (tenant_id, lower(btrim(label)));

comment on table public.os_commission_roles is
  'A commission role and where its person comes from on a deal. Roles are data, the places a person can come from are fixed.';
comment on column public.os_commission_roles.person_source is
  'deal_sales, deal_es, deal_sdr: picked on the deal in Gio Sales. partner_owner: the partner''s owner when the partner joins the deal. hire_sourcer, hire_recruiter: from the hire in Gio ATS.';

-- A key from the label: "Partner Originator" becomes partner_originator.
create or replace function public.os_commission_role_key(_tenant_id uuid, _label text)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  base text := left(trim(both '_' from regexp_replace(lower(coalesce(_label, '')), '[^a-z0-9]+', '_', 'g')), 36);
  k text;
  n int := 1;
begin
  if base = '' or base !~ '^[a-z]' then base := 'role_' || coalesce(nullif(base, ''), 'x'); end if;
  k := base;
  while exists (select 1 from public.os_commission_roles r where r.tenant_id = _tenant_id and r.key = k) loop
    n := n + 1;
    k := base || '_' || n;
  end loop;
  return k;
end;
$function$;

create or replace function public.os_commission_roles_validate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  seeding boolean := coalesce(current_setting('gio.commission_seed', true), '') = 'on';
begin
  new.label := btrim(new.label);
  new.description := nullif(btrim(new.description), '');
  if tg_op = 'INSERT' then
    if not seeding then
      new.built_in := false;
      new.key := public.os_commission_role_key(new.tenant_id, new.label);
    end if;
    new.created_by := auth.uid();
    new.created_at := now();
  else
    if new.tenant_id is distinct from old.tenant_id or new.key is distinct from old.key
       or new.person_source is distinct from old.person_source or new.built_in is distinct from old.built_in
       or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
      raise exception 'A role keeps where its person comes from. Add a new role instead.' using errcode = 'GCR01';
    end if;
    if old.built_in and not new.active then
      raise exception '% is a built-in role and stays on. Set its rate to 0 to pay nothing.', old.label
        using errcode = 'GCR02';
    end if;
  end if;
  new.updated_at := now();
  -- Any change goes to Gio Sales again.
  if not seeding then
    new.sync_status := 'pending';
    new.sync_error := null;
    new.sync_attempts := 0;
    new.synced_at := null;
  end if;
  return new;
end;
$function$;

create trigger os_commission_roles_validate
  before insert or update on public.os_commission_roles
  for each row execute function public.os_commission_roles_validate();

create or replace function public.os_commission_roles_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('gio.commission_seed', true), '') = 'on' then return new; end if;
  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (new.tenant_id, auth.uid(), null,
          case when tg_op = 'INSERT' then 'commission.role_added' else 'commission.role_changed' end,
          jsonb_build_object('key', new.key, 'label', new.label, 'active', new.active,
                             'person_source', new.person_source));
  return new;
end;
$function$;

create trigger os_commission_roles_audit
  after insert or update on public.os_commission_roles
  for each row execute function public.os_commission_roles_audit();

-- ── 2. Rules ──────────────────────────────────────────────────────────────
create table public.os_commission_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id)
    check (tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'::uuid),
  role_id uuid not null references public.os_commission_roles(id),
  -- Versions of one rule share a series; the latest on or before a day is in force.
  series_id uuid not null,
  effective_from date not null check (effective_from >= date '2020-01-01'),
  -- From this version's date, the rule no longer applies.
  stopped boolean not null default false,
  basis text not null check (basis in ('percent', 'fixed')),
  pct numeric(5, 2) check (pct is null or (pct >= 0 and pct <= 100)),
  amount numeric(12, 2) check (amount is null or amount > 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  payable_on text not null default 'payment' check (payable_on in ('payment', 'lead_accepted')),
  applies_to text not null check (applies_to in ('services', 'partner_items')),
  -- Virgilio's services: which fees (null = every fee), as Gio Sales names them.
  fees text[] check (fees is null or (cardinality(fees) > 0
    and fees <@ array['engagement', 'success', 'ta-other', 'consulting', 'c-other']::text[])),
  client text not null default 'any' check (client in ('any', 'new', 'existing')),
  -- Partner items: fixed amounts, recurring (percentage) items, or both.
  partner_items text not null default 'any' check (partner_items in ('any', 'fixed', 'recurring')),
  -- How long: null = always, or N months from the first paid invoice for that client.
  months integer check (months is null or months between 1 and 120),
  note text check (note is null or char_length(note) <= 300),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  -- Delivery to Gio Sales (step 2).
  sync_status text not null default 'pending' check (sync_status in ('pending', 'done', 'refused')),
  sync_error text check (sync_error is null or length(sync_error) <= 500),
  sync_attempts integer not null default 0,
  synced_at timestamptz,
  unique (series_id, effective_from),
  constraint os_commission_rules_percent check (stopped or basis <> 'percent' or (pct is not null and amount is null and currency is null)),
  constraint os_commission_rules_fixed check (stopped or basis <> 'fixed' or (amount is not null and currency is not null and pct is null)),
  constraint os_commission_rules_lead check (payable_on <> 'lead_accepted'
    or (basis = 'fixed' and applies_to = 'partner_items' and partner_items = 'fixed'))
);
create index os_commission_rules_series on public.os_commission_rules (series_id, effective_from desc);
create index os_commission_rules_role on public.os_commission_rules (role_id);
create index os_commission_rules_pending on public.os_commission_rules (created_at) where sync_status = 'pending';

comment on table public.os_commission_rules is
  'What a commission role is paid. Append-only: a change is a new version (same series_id) from a later date, stopped = true ends the rule.';

create or replace function public.os_commission_rules_validate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  seeding boolean := coalesce(current_setting('gio.commission_seed', true), '') = 'on';
  ro public.os_commission_roles%rowtype;
  prev public.os_commission_rules%rowtype;
begin
  select * into ro from public.os_commission_roles where id = new.role_id;
  if ro.id is null or ro.tenant_id <> new.tenant_id then
    raise exception 'That role is not in this workspace.' using errcode = 'GCR03';
  end if;
  if not ro.active then
    raise exception '% is switched off. Switch it on to give it rules.', ro.label using errcode = 'GCR03';
  end if;

  -- A new version continues its series, for the same role.
  if new.series_id is not null then
    select * into prev from public.os_commission_rules
     where series_id = new.series_id and effective_from <= new.effective_from
     order by effective_from desc limit 1;
    if prev.id is null then
      select * into prev from public.os_commission_rules
       where series_id = new.series_id order by effective_from limit 1;
    end if;
  end if;
  if prev.id is not null and prev.role_id <> new.role_id then
    raise exception 'A rule stays with its role.' using errcode = 'GCR04';
  end if;
  if new.series_id is null then
    if new.stopped then
      raise exception 'Only an existing rule can be stopped.' using errcode = 'GCR07';
    end if;
    if ro.built_in and not seeding then
      raise exception '% has one rule for now. Change its rate instead.', ro.label using errcode = 'GCR08';
    end if;
    new.series_id := gen_random_uuid();
  elsif prev.id is null then
    if not seeding then
      raise exception 'Only an existing rule can be stopped or changed.' using errcode = 'GCR07';
    end if;
  end if;

  -- A stopped version, or a built-in role's new rate, keeps the rule's terms.
  if prev.id is not null and (new.stopped or ro.built_in) then
    new.basis := prev.basis;
    new.payable_on := prev.payable_on;
    new.applies_to := prev.applies_to;
    new.fees := prev.fees;
    new.client := prev.client;
    new.partner_items := prev.partner_items;
    new.months := prev.months;
    if new.stopped then
      new.pct := prev.pct; new.amount := prev.amount; new.currency := prev.currency;
    end if;
  end if;

  new.currency := upper(nullif(btrim(new.currency), ''));
  new.note := nullif(btrim(new.note), '');
  if new.basis = 'percent' then
    if new.pct is null then
      raise exception 'Enter the percentage.' using errcode = 'GCR05';
    end if;
    new.amount := null; new.currency := null;
  elsif new.basis = 'fixed' then
    if new.amount is null or new.currency is null then
      raise exception 'Enter the amount and its currency.' using errcode = 'GCR05';
    end if;
    new.pct := null;
  end if;
  if new.payable_on = 'lead_accepted' then
    if new.basis <> 'fixed' or new.applies_to <> 'partner_items' then
      raise exception 'Only a fixed amount on partner items can be paid when a lead is accepted.'
        using errcode = 'GCR06';
    end if;
    new.partner_items := 'fixed';
  end if;
  if new.applies_to = 'services' then
    new.partner_items := 'any';
  else
    new.fees := null;
  end if;

  new.created_by := auth.uid();
  new.created_at := now();
  if not seeding then
    new.sync_status := 'pending';
    new.sync_error := null;
    new.sync_attempts := 0;
    new.synced_at := null;
  end if;
  return new;
end;
$function$;

create trigger os_commission_rules_validate
  before insert on public.os_commission_rules
  for each row execute function public.os_commission_rules_validate();

-- A built-in role's new rate also goes where Gio Sales reads it today.
create or replace function public.os_commission_rules_mirror()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  ro public.os_commission_roles%rowtype;
begin
  if coalesce(current_setting('gio.commission_seed', true), '') = 'on' then return null; end if;
  select * into ro from public.os_commission_roles where id = new.role_id;
  if not ro.built_in or new.basis <> 'percent' then return null; end if;
  if exists (select 1 from public.os_commission_rates r
             where r.tenant_id = new.tenant_id and r.role_key = ro.key and r.effective_from = new.effective_from) then
    raise exception '% already has a rate from %.', ro.label, to_char(new.effective_from, 'Mon FMDD, YYYY')
      using errcode = 'GCR09';
  end if;
  insert into public.os_commission_rates (tenant_id, role_key, pct, effective_from, note)
  values (new.tenant_id, ro.key, case when new.stopped then 0 else new.pct end, new.effective_from, new.note);
  return null;
end;
$function$;

create trigger os_commission_rules_mirror
  after insert on public.os_commission_rules
  for each row execute function public.os_commission_rules_mirror();

create or replace function public.os_commission_rules_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('gio.commission_seed', true), '') = 'on' then return null; end if;
  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (new.tenant_id, auth.uid(), null,
          case when new.stopped then 'commission.rule_stopped' else 'commission.rule_added' end,
          jsonb_build_object('role_id', new.role_id, 'series_id', new.series_id,
                             'effective_from', new.effective_from, 'basis', new.basis,
                             'pct', new.pct, 'amount', new.amount, 'currency', new.currency,
                             'payable_on', new.payable_on, 'applies_to', new.applies_to,
                             'months', new.months));
  return null;
end;
$function$;

create trigger os_commission_rules_audit
  after insert on public.os_commission_rules
  for each row execute function public.os_commission_rules_audit();

-- The rules in force on a day: each series' latest version on or before it, unless stopped.
create or replace function public.os_commission_rules_in_force(_tenant_id uuid, _on date default current_date)
returns setof public.os_commission_rules
language sql
stable
security definer
set search_path to 'public'
as $function$
  select v.* from (
    select distinct on (r.series_id) r.*
      from public.os_commission_rules r
     where r.tenant_id = _tenant_id and r.effective_from <= _on
     order by r.series_id, r.effective_from desc
  ) v
  join public.os_commission_roles ro on ro.id = v.role_id and ro.active
  where not v.stopped
    and (public.is_os_admin(_tenant_id) or public.user_has_active_tenant_membership(_tenant_id)
         or auth.role() = 'service_role');
$function$;

revoke all on function public.os_commission_rules_in_force(uuid, date) from public, anon;
grant execute on function public.os_commission_rules_in_force(uuid, date) to authenticated, service_role;
revoke all on function public.os_commission_role_key(uuid, text) from public, anon, authenticated;

-- ── Row level security ───────────────────────────────────────────────────
alter table public.os_commission_roles enable row level security;
alter table public.os_commission_rules enable row level security;

create policy os_commission_roles_read on public.os_commission_roles
  for select to authenticated
  using (public.is_os_admin(tenant_id) or public.user_has_active_tenant_membership(tenant_id));
create policy os_commission_roles_insert on public.os_commission_roles
  for insert to authenticated with check (public.is_os_admin(tenant_id));
create policy os_commission_roles_update on public.os_commission_roles
  for update to authenticated using (public.is_os_admin(tenant_id)) with check (public.is_os_admin(tenant_id));

create policy os_commission_rules_read on public.os_commission_rules
  for select to authenticated
  using (public.is_os_admin(tenant_id) or public.user_has_active_tenant_membership(tenant_id));
create policy os_commission_rules_insert on public.os_commission_rules
  for insert to authenticated with check (public.is_os_admin(tenant_id));

revoke all on public.os_commission_roles from anon, authenticated;
revoke all on public.os_commission_rules from anon, authenticated;
grant select on public.os_commission_roles to authenticated;
grant insert (tenant_id, label, description, person_source, position) on public.os_commission_roles to authenticated;
grant update (label, description, active, position) on public.os_commission_roles to authenticated;
grant select on public.os_commission_rules to authenticated;
grant insert (tenant_id, role_id, series_id, effective_from, stopped, basis, pct, amount, currency,
              payable_on, applies_to, fees, client, partner_items, months, note)
  on public.os_commission_rules to authenticated;

-- Rates are now added as rules; the mirror above keeps os_commission_rates filled.
revoke insert on public.os_commission_rates from authenticated;

-- ── 3 and 4. The starting roles and rules ────────────────────────────────
select set_config('gio.commission_seed', 'on', true);

insert into public.os_commission_roles (tenant_id, key, label, description, person_source, built_in, position, sync_status)
values
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'sales_new', 'Sales (new client)', 'Whoever closed the sale, on a new client.', 'deal_sales', true, 10, 'pending'),
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'sales_existing', 'Sales (existing client)', 'Whoever closed the sale, on an existing client.', 'deal_sales', true, 20, 'pending'),
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'es', 'Engagement Specialist', 'Who looks after the account.', 'deal_es', true, 30, 'pending'),
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'sp', 'Sourcer', 'Who sourced the hire.', 'hire_sourcer', true, 40, 'pending'),
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'tap', 'Recruiter', 'Who recruited the hire.', 'hire_recruiter', true, 50, 'pending'),
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'sdr', 'SDR', 'Who sends the lead. One per deal.', 'deal_sdr', false, 60, 'pending'),
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'partner_originator', 'Partner Originator', 'The partner''s owner when the partner joins the deal.', 'partner_owner', false, 70, 'pending');

-- Today's rates, one series per built-in role (the series is the role's id).
insert into public.os_commission_rules (tenant_id, role_id, series_id, effective_from, basis, pct,
                                        payable_on, applies_to, fees, client, note)
select r.tenant_id, ro.id, ro.id, r.effective_from, 'percent', r.pct, 'payment', 'services',
       case when ro.key in ('sp', 'tap') then array['success']::text[]
            else array['success', 'ta-other', 'consulting', 'c-other']::text[] end,
       case ro.key when 'sales_new' then 'new' when 'sales_existing' then 'existing' else 'any' end,
       r.note
  from public.os_commission_rates r
  join public.os_commission_roles ro on ro.tenant_id = r.tenant_id and ro.key = r.role_key;

insert into public.os_commission_rules (tenant_id, role_id, series_id, effective_from, basis, amount, currency,
                                        payable_on, applies_to, partner_items, note)
select tenant_id, id, id, date '2026-10-26', 'fixed', 100, 'USD', 'lead_accepted', 'partner_items', 'fixed',
       'Each lead a partner accepts (Allan, 2026-10-26)'
  from public.os_commission_roles where key = 'sdr';

insert into public.os_commission_rules (tenant_id, role_id, series_id, effective_from, basis, pct,
                                        payable_on, applies_to, partner_items, months, note)
select tenant_id, id, id, date '2026-10-26', 'percent', 10, 'payment', 'partner_items', 'recurring', 12,
       'What partners pay on recurring items, 12 months per client (Allan, 2026-10-26)'
  from public.os_commission_roles where key = 'partner_originator';

select set_config('gio.commission_seed', 'off', true);
