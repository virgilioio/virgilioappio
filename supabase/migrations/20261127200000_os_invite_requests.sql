-- People & Access: one person's invitation to Gio Sales or Gio Docs (2026-11-27).
--
-- The Apps and roles card asks the app where the invitation stands, and can
-- hand over a working link or give it 7 more days, through the os-invite Edge
-- Function. This checks who may ask (People & Access admins, never about
-- themselves, only an app they have access to) and answers the two addresses
-- the app needs. Handing over a link and extending are written to the
-- person's history; reading the status is not.

create or replace function public.os_invite_request(_tenant_id uuid, _user_id uuid, _app text, _action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  live public.os_app_grants%rowtype;
  v_email text;
  v_actor text;
begin
  if not public.is_os_admin(_tenant_id) then
    raise exception 'Only admins can manage invitations.' using errcode = '42501';
  end if;
  if _user_id = auth.uid() then
    raise exception 'You can''t manage your own invitation. Ask another admin.' using errcode = 'GOS03';
  end if;
  if _app not in ('docs', 'sales') then
    raise exception 'Only Gio Docs and Gio Sales send invitations.' using errcode = 'GOS02';
  end if;
  if _action is null or _action not in ('status', 'link', 'renew') then
    raise exception 'Unknown invitation action.' using errcode = 'GOS02';
  end if;

  select * into live from public.os_app_grants
  where tenant_id = _tenant_id and user_id = _user_id and app_key = _app and status <> 'revoked';
  if not found then
    raise exception 'They don''t have access to this app, so there is no invitation.' using errcode = 'GOS02';
  end if;

  select lower(email) into v_email from auth.users where id = _user_id;
  select lower(email) into v_actor from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'This person has no email address.' using errcode = 'GOS02';
  end if;

  if _action in ('link', 'renew') then
    insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, app_key, detail)
    values (_tenant_id, auth.uid(), _user_id,
            case _action when 'link' then 'grant.link_shared' else 'grant.extended' end,
            _app, jsonb_build_object('role', live.role));
  end if;

  return jsonb_build_object('email', v_email, 'actor_email', v_actor, 'role', live.role, 'grant_status', live.status);
end $$;

revoke all on function public.os_invite_request(uuid, uuid, text, text) from public, anon;
grant execute on function public.os_invite_request(uuid, uuid, text, text) to authenticated;

comment on function public.os_invite_request(uuid, uuid, text, text) is
  'People & Access admins asking about one person''s Gio Sales or Gio Docs invitation (status, link, renew), through the os-invite Edge Function. Link and renew are written to the history.';
