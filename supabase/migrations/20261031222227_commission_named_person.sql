-- Commission roles held by one named person (Allan, 2026-10-31).
--
-- Until now a role's person always came from the deal or the hire. A role like
-- F&A Manager is one person at Virgilio, named on the role: person_source
-- 'named_person' with holder_user_id. The holder is one of Virgilio's own
-- active people, never an external user (GCR10), and can change; the change is
-- in the history and goes to Gio Sales like any change to a role. A named
-- person's role earns on Virgilio's services only (GCR11).
--
-- Engagement fees (retainers) never earn commission: they are Virgilio's
-- (Allan, 2026-10-31). A rule on services can't include them (GCR12), and a
-- services rule with no fee list means every fee except engagement.

alter table public.os_commission_roles
  add column holder_user_id uuid references auth.users(id);

alter table public.os_commission_roles drop constraint os_commission_roles_person_source_check;
alter table public.os_commission_roles add constraint os_commission_roles_person_source_check
  check (person_source = any (array['deal_sales', 'deal_es', 'deal_sdr', 'partner_owner',
                                    'hire_sourcer', 'hire_recruiter', 'named_person']));
alter table public.os_commission_roles add constraint os_commission_roles_holder
  check ((person_source = 'named_person') = (holder_user_id is not null));

grant select (holder_user_id), insert (holder_user_id), update (holder_user_id)
  on public.os_commission_roles to authenticated;

-- No rule includes engagement fees today; this keeps it that way.
alter table public.os_commission_rules drop constraint os_commission_rules_fees_check;
alter table public.os_commission_rules add constraint os_commission_rules_fees_check
  check (fees is null or (cardinality(fees) > 0 and fees <@ array['success', 'ta-other', 'consulting', 'c-other']));

create or replace function public.os_commission_roles_validate()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  seeding boolean := coalesce(current_setting('gio.commission_seed', true), '') = 'on';
begin
  -- Only delivery fields changed (os_commission_role_record): keep it as it is.
  if tg_op = 'UPDATE'
     and (btrim(new.label), nullif(btrim(new.description), ''), new.active, new.position,
          new.tenant_id, new.key, new.person_source, new.built_in, new.created_by, new.created_at,
          new.holder_user_id)
         is not distinct from
         (old.label, old.description, old.active, old.position,
          old.tenant_id, old.key, old.person_source, old.built_in, old.created_by, old.created_at,
          old.holder_user_id) then
    new.label := old.label;
    new.description := old.description;
    return new;
  end if;
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
  -- A named person: one of Virgilio's own active people.
  if new.person_source = 'named_person' then
    if new.holder_user_id is null then
      raise exception 'Choose who holds this role.' using errcode = 'GCR10';
    end if;
    if (tg_op = 'INSERT' or new.holder_user_id is distinct from old.holder_user_id)
       and not exists (select 1 from public.members m
                        where m.user_id = new.holder_user_id and m.tenant_id = new.tenant_id
                          and m.user_status = 'active' and m.user_type is distinct from 'external') then
      raise exception 'Only someone active on Virgilio''s team can hold a commission role.' using errcode = 'GCR10';
    end if;
  else
    new.holder_user_id := null;
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

create or replace function public.os_commission_roles_audit()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('gio.commission_seed', true), '') = 'on' then return new; end if;
  -- Recording Gio Sales' answer isn't a change to the role.
  if tg_op = 'UPDATE' and new.updated_at is not distinct from old.updated_at then return new; end if;
  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (new.tenant_id, auth.uid(), new.holder_user_id,
          case when tg_op = 'INSERT' then 'commission.role_added' else 'commission.role_changed' end,
          jsonb_build_object('key', new.key, 'label', new.label, 'active', new.active,
                             'person_source', new.person_source)
          || case when new.holder_user_id is not null
                  then jsonb_build_object('holder_user_id', new.holder_user_id) else '{}'::jsonb end);
  return new;
end;
$function$;

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
  if ro.person_source = 'named_person' and new.applies_to <> 'services' then
    raise exception '% earns on Virgilio''s services only.', ro.label using errcode = 'GCR11';
  end if;
  if new.applies_to = 'services' then
    new.partner_items := 'any';
    -- Engagement fees (retainers) are Virgilio's: never commissioned.
    if 'engagement' = any (coalesce(new.fees, '{}')) then
      raise exception 'Engagement fees are Virgilio''s and never earn commission.' using errcode = 'GCR12';
    end if;
    new.fees := coalesce(new.fees, array['success', 'ta-other', 'consulting', 'c-other']);
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
