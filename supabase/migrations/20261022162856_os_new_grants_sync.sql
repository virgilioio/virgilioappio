-- People & Access: a new app grant is sent to the app again (Allan, 2026-10-22).
--
-- os_set_app_role decided whether to queue a change by reading FOUND after its
-- own INSERT into os_app_grants, which sets FOUND to true. A first grant
-- (no live grant before) therefore read as "found", compared a null role and
-- queued nothing: the grant stayed "pending" and Gio Docs / Gio Sales never
-- heard of it. Since 2026-10-16 that left 10 grants waiting, among them
-- victoria@virgilio.tech in Gio Docs, who signs in and sees an empty screen.
-- Role changes and removals were queued and are unaffected.
--
-- 1. os_set_app_role keeps whether a live grant existed in its own variable.
-- 2. Every pending grant with nothing waiting in the queue is queued now, as
--    the admin who granted it; os-sync (pg_cron, every 5 minutes) sends it.
--    People already in the app come back "unchanged" and turn active; people
--    who aren't get the app's usual invitation email.

create or replace function public.os_set_app_role(_tenant_id uuid, _user_id uuid, _app text, _role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  target public.members%rowtype;
  live public.os_app_grants%rowtype;
  had_live boolean;
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
  -- FOUND changes with every statement below, so keep this answer.
  had_live := found;

  if had_live and (_role is null or live.role <> _role) then
    update public.os_app_grants set status = 'revoked' where id = live.id;
  end if;

  if _role is not null and (not had_live or live.role <> _role) then
    insert into public.os_app_grants (tenant_id, user_id, app_key, role, status, synced_at)
    values (
      _tenant_id, _user_id, _app, _role,
      case when _app = 'ats' then 'active' else 'pending' end,
      case when _app = 'ats' then now() else null end
    );
  end if;

  -- Queue the change for the app that enforces it. A removal is queued only
  -- when there was something to remove; an unchanged role re-sends only when
  -- the earlier send failed (status error), so Retry works.
  if _app <> 'ats' then
    if (_role is null and had_live)
       or (_role is not null and (not had_live or live.role <> _role or live.status = 'error')) then
      if _role is not null and had_live and live.role = _role and live.status = 'error' then
        update public.os_app_grants set status = 'pending', sync_error = null where id = live.id;
      end if;
      perform public.os_sync_enqueue(_tenant_id, _user_id, _app, _role, auth.uid());
    end if;
  end if;
end;
$function$;

-- The grants this left waiting, sent now as the admin who granted them.
do $$
declare g record;
begin
  for g in
    select gr.tenant_id, gr.user_id, gr.app_key, gr.role, gr.granted_by
    from public.os_app_grants gr
    where gr.status = 'pending' and gr.app_key <> 'ats' and gr.granted_by is not null
      and not exists (select 1 from public.os_sync_queue q
                      where q.tenant_id = gr.tenant_id and q.user_id = gr.user_id
                        and q.app_key = gr.app_key and q.status = 'pending')
  loop
    perform public.os_sync_enqueue(g.tenant_id, g.user_id, g.app_key, g.role, g.granted_by);
  end loop;
end $$;
