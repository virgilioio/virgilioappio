-- Job-based access: speed (2026-10-14). With the switch on, a hiring
-- manager's queries ran the full access check on every row (13 s for 2,700
-- email logs). The answer to "may this person use this workspace's talent
-- pool?" doesn't change within a request, so it is now worked out once per
-- request (transaction) and remembered in a transaction-local setting. The
-- switch itself is still read every time, so turning it off takes effect at
-- once. The org-tree helper checks before toggling row security, so the
-- common "no" costs one remembered lookup.
-- Behaviour is unchanged; only speed.

create or replace function public.wwa_memo(_tenant_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  k text;
  v text;
  me text := coalesce(auth.uid()::text, '');
  r boolean;
begin
  if _tenant_id is null then
    return false;
  end if;
  if not coalesce((select (t.settings->>'job_based_access')::boolean from public.tenants t where t.id = _tenant_id), false) then
    return true;
  end if;
  k := 'gio.wwa_' || replace(_tenant_id::text, '-', '');
  v := current_setting(k, true);
  if v is not null and v <> '' and split_part(v, '|', 1) = me then
    return split_part(v, '|', 2) = 't';
  end if;
  r := exists (
         select 1 from public.members ma
         where ma.user_id = auth.uid() and ma.user_status = 'active'
           and (ma.user_type = 'platform_admin' or (ma.tenant_id = _tenant_id and (ma.user_type = 'workspace_owner' or ma.system_role = 'admin')))
       )
       or exists (
         select 1 from public.job_assignments jx join public.jobs jj on jj.id = jx.job_id
         where jx.user_id = auth.uid() and jx.deleted_at is null and jx.role in ('recruiter', 'sourcer')
           and jj.status in ('draft', 'open') and jj.tenant_id = _tenant_id
       );
  perform set_config(k, me || '|' || case when r then 't' else 'f' end, true);
  return r;
end;
$function$;

revoke execute on function public.wwa_memo(uuid) from public, anon;
grant execute on function public.wwa_memo(uuid) to authenticated, service_role;

create or replace function public.user_has_tenant_access(check_tenant_id uuid)
returns boolean
language sql
stable
security definer
as $function$
  select exists (
    select 1 from public.members m
    where m.user_id = auth.uid() and m.tenant_id = check_tenant_id
      and m.user_status = 'active'
  ) and public.wwa_memo(check_tenant_id);
$function$;

create or replace function public.check_org_hierarchy_role_access(_organization_id uuid, _required_role text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.members m
    join public.organizations o on m.tenant_id = o.tenant_id
    where o.id = _organization_id
      and m.user_id = auth.uid()
      and m.user_status = 'active'
      and (
        m.user_type in ('workspace_owner', 'platform_admin')
        or (
          case when _required_role = 'admin'
            then m.system_role = 'admin'
            else m.system_role in ('admin', 'member') and public.wwa_memo(o.tenant_id)
          end
        )
      )
  )
$function$;

create or replace function public.check_tenant_member_role(tenant_id_param uuid, required_role text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if exists (
    select 1 from public.members
    where user_id = auth.uid() and user_type = 'platform_admin' and user_status = 'active'
  ) then
    return true;
  end if;

  if required_role = 'recruiter' then
    return exists (
      select 1 from public.members m
      where m.user_id = auth.uid() and m.tenant_id = tenant_id_param and m.user_status = 'active'
        and (m.user_type = 'workspace_owner' or m.system_role in ('admin', 'member'))
    ) and public.wwa_memo(tenant_id_param);
  else
    return exists (
      select 1 from public.members m
      where m.user_id = auth.uid() and m.tenant_id = tenant_id_param and m.user_status = 'active'
        and (m.user_type = 'workspace_owner' or m.system_role = 'admin')
    );
  end if;
end;
$function$;

create or replace function public.has_workspace_wide_access(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.wwa_memo(_tenant_id);
$function$;

create or replace function public.user_has_org_hierarchy_access(target_org_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_user_id uuid;
  member_org_id uuid;
  org_tree_ids uuid[];
  target_tenant uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return false;
  end if;

  -- Job-based access: outside admins and TA/Sourcer seats, the org tree no
  -- longer grants anything. Checked first, without toggling row security
  -- (this function's owner reads these tables directly).
  select o.tenant_id into target_tenant from public.organizations o where o.id = target_org_id;
  if target_tenant is not null and not public.wwa_memo(target_tenant) then
    return false;
  end if;

  set local row_security = off;

  for member_org_id in
    select organization_id
    from public.members
    where user_id = current_user_id
      and user_status = 'active'
  loop
    select array_agg(id) into org_tree_ids
    from (
      select member_org_id as id
      union
      select parent_organization_id as id
      from public.organizations
      where id = member_org_id
        and parent_organization_id is not null
      union
      select o.id
      from public.organizations o
      where o.parent_organization_id = (
        select parent_organization_id
        from public.organizations
        where id = member_org_id
      )
      and o.parent_organization_id is not null
      union
      select o.id
      from public.organizations o
      where o.parent_organization_id = member_org_id
    ) tree;

    if target_org_id = any(org_tree_ids) then
      set local row_security = on;
      return true;
    end if;
  end loop;

  set local row_security = on;
  return false;
end;
$function$;
