-- Gio OS: People & Access, the two functions behind the module's screens
-- (2026-10-14, Part B). Both are for workspace admins and platform admins
-- only, checked inside the function.
--
-- os_people(): one row per person in the workspace with what the People list
-- shows. It reads Google connection health and job counts that admins can't
-- read row by row (mail identities are owner-only), and returns only status
-- words and counts, never tokens.
--
-- os_set_app_role(): the one way the module changes someone's app access.
-- For the ATS it changes members.system_role, which is what the ATS enforces;
-- for every other app it records the grant for People & Access to send to that
-- app (Part D). A null role removes access. Every change is logged by the
-- os_app_grants triggers.

create or replace function public.os_people(_tenant_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  avatar_url text,
  member_status text,
  system_role text,
  user_type text,
  last_sign_in_at timestamptz,
  profile_status text,
  bundle_id uuid,
  google_email text,
  google_status text,
  active_jobs int,
  closed_jobs int,
  grants jsonb
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_os_admin(_tenant_id) then
    raise exception 'Only admins can see People & Access.' using errcode = '42501';
  end if;

  return query
  select
    m.id,
    m.user_id,
    coalesce(p.email, u.email, m.invited_email)::text,
    p.first_name,
    p.last_name,
    p.avatar_url,
    m.user_status::text,
    m.system_role::text,
    m.user_type::text,
    u.last_sign_in_at,
    coalesce(op.status, 'active'),
    op.bundle_id,
    g.email_address,
    case
      when g.id is null then 'not_connected'
      when g.sync_status in ('expired', 'error', 'revoked') then 'reconnect'
      else 'connected'
    end,
    coalesce(jobs.active, 0)::int,
    coalesce(jobs.closed, 0)::int,
    coalesce(gr.grants, '[]'::jsonb)
  from public.members m
  left join auth.users u on u.id = m.user_id
  left join public.profiles p on p.user_id = m.user_id
  left join public.os_person_profile op on op.tenant_id = m.tenant_id and op.user_id = m.user_id
  left join lateral (
    select i.id, i.email_address, i.sync_status
    from public.user_mail_identities i
    where i.user_id = m.user_id and i.is_active
    order by i.is_default desc nulls last, i.updated_at desc
    limit 1
  ) g on true
  left join lateral (
    select
      count(distinct ja.job_id) filter (where j.status in ('draft', 'open')) as active,
      count(distinct ja.job_id) filter (where j.status in ('closed', 'archived')) as closed
    from public.job_assignments ja
    join public.jobs j on j.id = ja.job_id
    where ja.user_id = m.user_id and ja.deleted_at is null and j.tenant_id = m.tenant_id
  ) jobs on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'app', a.app_key, 'role', a.role, 'status', a.status,
      'sync_error', a.sync_error, 'granted_at', a.granted_at
    ) order by a.app_key) as grants
    from public.os_app_grants a
    where a.tenant_id = m.tenant_id and a.user_id = m.user_id and a.status <> 'revoked'
  ) gr on true
  where m.tenant_id = _tenant_id;
end;
$function$;

revoke execute on function public.os_people(uuid) from public, anon;
grant execute on function public.os_people(uuid) to authenticated, service_role;

create or replace function public.os_set_app_role(_tenant_id uuid, _user_id uuid, _app text, _role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  target public.members%rowtype;
  live public.os_app_grants%rowtype;
begin
  if not public.is_os_admin(_tenant_id) then
    raise exception 'Only admins can change access.' using errcode = '42501';
  end if;
  if _user_id = auth.uid() then
    raise exception 'You can''t change your own access. Ask another admin.' using errcode = 'GOS03';
  end if;
  if not exists (select 1 from public.os_apps a where a.key = _app) then
    raise exception 'Unknown app.' using errcode = 'GOS02';
  end if;
  if _role is not null and not exists (select 1 from public.os_apps a where a.key = _app and _role = any (a.roles)) then
    raise exception '% is not a role in %.', _role, _app using errcode = 'GOS02';
  end if;

  select * into target from public.members
  where tenant_id = _tenant_id and user_id = _user_id
  order by (user_status = 'active') desc
  limit 1;
  if not found then
    raise exception 'This person is not a member of the workspace.' using errcode = 'GOS02';
  end if;

  if _app = 'ats' then
    if _role is null then
      raise exception 'Everyone in People & Access has an ATS membership. Offboard the person to remove it.' using errcode = 'GOS04';
    end if;
    if target.user_type = 'platform_admin' and public.get_user_type_secure() <> 'platform_admin' then
      raise exception 'Only a platform admin can change a platform admin.' using errcode = 'GOS03';
    end if;
    -- The workspace always keeps at least one active admin.
    if target.system_role = 'admin' and _role <> 'admin' and target.user_status = 'active'
       and not exists (
         select 1 from public.members o
         where o.tenant_id = _tenant_id and o.user_status = 'active' and o.system_role = 'admin' and o.id <> target.id
       ) then
      raise exception 'The workspace needs at least one admin.' using errcode = 'GOS04';
    end if;
    update public.members set system_role = _role::public.system_role where id = target.id;
  end if;

  select * into live from public.os_app_grants
  where tenant_id = _tenant_id and user_id = _user_id and app_key = _app and status <> 'revoked';

  if found and (_role is null or live.role <> _role) then
    update public.os_app_grants set status = 'revoked' where id = live.id;
  end if;

  if _role is not null and (not found or live.role <> _role) then
    insert into public.os_app_grants (tenant_id, user_id, app_key, role, status, synced_at)
    values (
      _tenant_id, _user_id, _app, _role,
      case when _app = 'ats' then 'active' else 'pending' end,
      case when _app = 'ats' then now() else null end
    );
  end if;
end;
$function$;

revoke execute on function public.os_set_app_role(uuid, uuid, text, text) from public, anon;
grant execute on function public.os_set_app_role(uuid, uuid, text, text) to authenticated, service_role;
