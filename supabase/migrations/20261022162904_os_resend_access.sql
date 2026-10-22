-- People & Access: resend an app invitation by hand (Allan, 2026-10-22).
--
-- os_resend_access(tenant, person, app) queues one send marked resend = true
-- for a live Gio Docs or Gio Sales grant. os-sync passes the flag on, and the
-- app's os_resend_invite sends a fresh invitation link to anyone who hasn't
-- joined yet (members are left alone and the answer says so).
--   * admins only, never for yourself, never for the ATS (it has no invitation);
--   * a send already waiting for that person and app is reused, so a double
--     click never queues two;
--   * a grant in error goes back to pending, as Retry does;
--   * the resend is written to the person's history (grant.resent).

alter table public.os_sync_queue add column if not exists resend boolean not null default false;

create or replace function public.os_resend_access(_tenant_id uuid, _user_id uuid, _app text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  live public.os_app_grants%rowtype;
  waiting uuid;
  v_id uuid;
begin
  if not public.is_os_admin(_tenant_id) then
    raise exception 'Only admins can change access.' using errcode = '42501';
  end if;
  if _user_id = auth.uid() then
    raise exception 'You can''t change your own access. Ask another admin.' using errcode = 'GOS03';
  end if;
  if _app not in ('docs', 'sales') then
    raise exception 'Only Gio Docs and Gio Sales send invitations.' using errcode = 'GOS02';
  end if;

  select * into live from public.os_app_grants
  where tenant_id = _tenant_id and user_id = _user_id and app_key = _app and status <> 'revoked';
  if not found then
    raise exception 'They don''t have access to this app, so there is no invitation to send.' using errcode = 'GOS02';
  end if;

  select id into waiting from public.os_sync_queue
  where tenant_id = _tenant_id and user_id = _user_id and app_key = _app and status = 'pending'
  order by created_at desc limit 1;
  if waiting is not null then
    return waiting;
  end if;

  if live.status = 'error' then
    update public.os_app_grants set status = 'pending', sync_error = null where id = live.id;
  end if;

  insert into public.os_sync_queue (tenant_id, user_id, app_key, role, actor_user_id, resend)
  values (_tenant_id, _user_id, _app, live.role, auth.uid(), true)
  returning id into v_id;

  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, app_key, detail)
  values (_tenant_id, auth.uid(), _user_id, 'grant.resent', _app, jsonb_build_object('role', live.role));

  return v_id;
end;
$function$;

revoke execute on function public.os_resend_access(uuid, uuid, text) from public, anon;
grant execute on function public.os_resend_access(uuid, uuid, text) to authenticated;
