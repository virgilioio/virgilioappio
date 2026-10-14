-- People & Access sends app grants to the apps that enforce them (design Part D,
-- Allan 2026-10-14). Gio Sales first; Gio Docs joins when its receiver exists.
--
-- Every change os_set_app_role() makes to a non-ATS app is queued here. The
-- `os-sync` edge function sends each item to the app (signed, with the item id
-- as the request id, so a retry is never applied twice), then records the
-- answer with os_sync_record(). The grant's status follows:
--   pending -> active                (applied, or already so)
--   pending -> error + sync_error    (the app refused, e.g. only a Gio Sales
--                                     owner can change a role)
-- A newer change for the same person and app supersedes an older unsent one.
-- Grants made before this migration stay pending and are not queued: they
-- wait for an admin to send them (os_sync_enqueue_existing) or change them.

create table public.os_sync_queue (
  id             uuid primary key default gen_random_uuid(),   -- the request id the app sees
  tenant_id      uuid not null references public.tenants(id),
  user_id        uuid not null references auth.users(id),
  app_key        text not null references public.os_apps(key) check (app_key <> 'ats'),
  role           text,                                          -- null = remove access
  actor_user_id  uuid not null references auth.users(id),
  status         text not null default 'pending'
                   check (status in ('pending', 'done', 'refused', 'superseded')),
  attempts       int not null default 0,
  last_error     text check (last_error is null or length(last_error) <= 500),
  outcome        text,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz,
  done_at        timestamptz
);

create index os_sync_queue_pending on public.os_sync_queue (created_at) where status = 'pending';

comment on table public.os_sync_queue is
  'Access changes waiting to reach Gio Sales / Gio Docs. Written by os_set_app_role(); sent by the os-sync edge function.';

alter table public.os_sync_queue enable row level security;

create policy os_sync_queue_read on public.os_sync_queue
  for select to authenticated
  using (public.is_os_admin(tenant_id));

-- Queue one change; older unsent changes for the same person and app give way.
create or replace function public.os_sync_enqueue(_tenant_id uuid, _user_id uuid, _app text, _role text, _actor uuid)
returns uuid language plpgsql security definer set search_path = 'public' as $$
declare v_id uuid;
begin
  if _app = 'ats' then return null; end if;
  update public.os_sync_queue set status = 'superseded', done_at = now()
  where tenant_id = _tenant_id and user_id = _user_id and app_key = _app and status = 'pending';
  insert into public.os_sync_queue (tenant_id, user_id, app_key, role, actor_user_id)
  values (_tenant_id, _user_id, _app, _role, _actor)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.os_sync_enqueue(uuid, uuid, text, text, uuid) from public, anon, authenticated;

-- An admin sends grants that were saved before the queue existed.
create or replace function public.os_sync_enqueue_existing(_tenant_id uuid, _app text)
returns int language plpgsql security definer set search_path = 'public' as $$
declare n int := 0; g record;
begin
  if not public.is_os_admin(_tenant_id) then
    raise exception 'Only admins can change access.' using errcode = '42501';
  end if;
  for g in
    select * from public.os_app_grants
    where tenant_id = _tenant_id and app_key = _app and status = 'pending'
      and user_id <> auth.uid()
      and not exists (select 1 from public.os_sync_queue q
                      where q.tenant_id = _tenant_id and q.user_id = os_app_grants.user_id
                        and q.app_key = _app and q.status = 'pending')
  loop
    perform public.os_sync_enqueue(_tenant_id, g.user_id, _app, g.role, auth.uid());
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.os_sync_enqueue_existing(uuid, text) from public, anon;
grant execute on function public.os_sync_enqueue_existing(uuid, text) to authenticated;

-- The sender records the app's answer (service role only).
create or replace function public.os_sync_record(_id uuid, _ok boolean, _outcome text, _detail text, _retry boolean)
returns void language plpgsql security definer set search_path = 'public' as $$
declare q public.os_sync_queue%rowtype;
begin
  select * into q from public.os_sync_queue where id = _id for update;
  if not found or q.status <> 'pending' then return; end if;

  if _retry then
    -- Couldn't reach the app: stays queued.
    update public.os_sync_queue
    set attempts = attempts + 1, sent_at = now(), last_error = left(_detail, 500)
    where id = _id;
    update public.os_app_grants set sync_error = left('Couldn''t reach the app yet. Retrying.', 500)
    where tenant_id = q.tenant_id and user_id = q.user_id and app_key = q.app_key
      and status = 'pending' and q.role is not distinct from role
      and sync_error is distinct from 'Couldn''t reach the app yet. Retrying.';
    return;
  end if;

  update public.os_sync_queue
  set status = case when _ok then 'done' else 'refused' end,
      attempts = attempts + 1, sent_at = now(), done_at = now(),
      outcome = _outcome, last_error = case when _ok then null else left(_detail, 500) end
  where id = _id;

  if q.role is not null then
    update public.os_app_grants
    set status = case when _ok then 'active' else 'error' end,
        synced_at = case when _ok then now() else synced_at end,
        sync_error = case when _ok then null else left(coalesce(_detail, 'The app refused this change.'), 500) end
    where tenant_id = q.tenant_id and user_id = q.user_id and app_key = q.app_key
      and status in ('pending', 'error') and role = q.role;
  end if;

  -- The grant's own audit trigger records grant.active / grant.error.
end $$;
revoke execute on function public.os_sync_record(uuid, boolean, text, text, boolean) from public, anon, authenticated;

-- os_set_app_role: same body as before, plus queueing the change for the app.
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

  -- NEW: queue the change for the app that enforces it. A removal is queued
  -- only when there was something to remove; an unchanged role re-sends only
  -- when the earlier send failed (status error), so Retry works.
  if _app <> 'ats' then
    if (_role is null and found)
       or (_role is not null and (not found or live.role <> _role or live.status = 'error')) then
      if _role is not null and found and live.role = _role and live.status = 'error' then
        update public.os_app_grants set status = 'pending', sync_error = null where id = live.id;
      end if;
      perform public.os_sync_enqueue(_tenant_id, _user_id, _app, _role, auth.uid());
    end if;
  end if;
end;
$function$;
