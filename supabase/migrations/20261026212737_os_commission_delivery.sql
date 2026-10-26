-- Commission roles and rules go to Gio Sales (Allan, 2026-10-26, step 1b).
--
-- os-sync delivers every role and every rule version waiting in
-- os_commission_roles / os_commission_rules to Gio Sales' os-provision (kinds
-- 'commission_role' and 'commission_rule', same endpoint and secret as rates)
-- and records each answer here:
--
-- 1. os_commission_role_record(id, updated_at, ok, detail, retry): settles a
--    role only if it hasn't changed since it was sent, so an edit made while
--    os-sync was sending goes out on the next run.
-- 2. os_commission_rule_record(id, ok, detail, retry): rules never change.
-- 3. The role triggers ignore updates that only touch the delivery fields:
--    recording an answer must not send the role again or write the history.

-- ── 1 and 2. Recording Gio Sales' answers ────────────────────────────────
create or replace function public.os_commission_role_record(_id uuid, _updated_at timestamptz, _ok boolean, _detail text, _retry boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.os_commission_roles
  set sync_attempts = sync_attempts + 1,
      sync_status = case when _ok then 'done' when _retry then 'pending' else 'refused' end,
      sync_error = case when _ok then null else left(_detail, 500) end,
      synced_at = case when _ok then now() else synced_at end
  where id = _id and updated_at = _updated_at;
end;
$function$;

revoke all on function public.os_commission_role_record(uuid, timestamptz, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.os_commission_role_record(uuid, timestamptz, boolean, text, boolean) to service_role;

create or replace function public.os_commission_rule_record(_id uuid, _ok boolean, _detail text, _retry boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.os_commission_rules
  set sync_attempts = sync_attempts + 1,
      sync_status = case when _ok then 'done' when _retry then 'pending' else 'refused' end,
      sync_error = case when _ok then null else left(_detail, 500) end,
      synced_at = case when _ok then now() else synced_at end
  where id = _id;
end;
$function$;

revoke all on function public.os_commission_rule_record(uuid, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.os_commission_rule_record(uuid, boolean, text, boolean) to service_role;

-- ── 3. Delivery-only updates don't count as changes ──────────────────────
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
          new.tenant_id, new.key, new.person_source, new.built_in, new.created_by, new.created_at)
         is not distinct from
         (old.label, old.description, old.active, old.position,
          old.tenant_id, old.key, old.person_source, old.built_in, old.created_by, old.created_at) then
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
  values (new.tenant_id, auth.uid(), null,
          case when tg_op = 'INSERT' then 'commission.role_added' else 'commission.role_changed' end,
          jsonb_build_object('key', new.key, 'label', new.label, 'active', new.active,
                             'person_source', new.person_source));
  return new;
end;
$function$;
