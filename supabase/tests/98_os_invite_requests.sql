-- People & Access invitation requests: only admins, never about themselves,
-- only an app the person has; link and renew are written to the history,
-- status isn't. Ends by raising its result: nothing is kept.
do $t$
declare
  tenant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  adm uuid;
  member uuid;
  subject uuid;
  nogrant uuid;
  app text;
  a jsonb;
  n0 int; n1 int;
  r text := '';
begin
  -- An active admin, an active non-admin member, and someone with a live Sales or Docs grant.
  -- The admin who last gave someone an app.
  select g.granted_by into adm from public.os_app_grants g
   where g.tenant_id = tenant and g.granted_by is not null order by g.granted_at desc limit 1;
  select m.user_id into member from public.members m
   where m.tenant_id = tenant and m.user_status = 'active' and m.system_role = 'member' and m.user_type = 'member'
   order by m.created_at limit 1;
  select g.user_id, g.app_key into subject, app from public.os_app_grants g
   where g.tenant_id = tenant and g.status <> 'revoked' and g.app_key in ('sales', 'docs') and g.user_id <> adm
   order by g.granted_at desc limit 1;

  -- Someone active with no live grant for that app.
  select m.user_id into nogrant from public.members m
   where m.tenant_id = tenant and m.user_status = 'active' and m.user_id <> adm
     and not exists (select 1 from public.os_app_grants g where g.tenant_id = tenant and g.user_id = m.user_id
                     and g.app_key = app and g.status <> 'revoked')
   order by m.created_at limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', adm::text, true);

  select count(*) into n0 from public.os_audit_log where subject_user_id = subject and action in ('grant.link_shared', 'grant.extended');
  a := public.os_invite_request(tenant, subject, app, 'status');
  r := r || 'status_email=' || (a->>'email' is not null)::text || ' actor=' || (a->>'actor_email' is not null)::text;   -- true true
  select count(*) into n1 from public.os_audit_log where subject_user_id = subject and action in ('grant.link_shared', 'grant.extended');
  r := r || ' status_not_logged=' || (n1 = n0)::text;                                                                   -- true
  perform public.os_invite_request(tenant, subject, app, 'link');
  perform public.os_invite_request(tenant, subject, app, 'renew');
  select count(*) into n1 from public.os_audit_log where subject_user_id = subject and action in ('grant.link_shared', 'grant.extended');
  r := r || ' logged=' || (n1 - n0);                                                                                    -- 2

  begin
    perform public.os_invite_request(tenant, adm, 'sales', 'status');
    r := r || ' self=ok';
  exception when others then r := r || ' self=' || sqlstate; end;                                                        -- GOS03
  begin
    perform public.os_invite_request(tenant, subject, 'ats', 'status');
    r := r || ' ats=ok';
  exception when others then r := r || ' ats=' || sqlstate; end;                                                         -- GOS02
  begin
    perform public.os_invite_request(tenant, subject, app, 'wipe');
    r := r || ' unknown_action=ok';
  exception when others then r := r || ' unknown_action=' || sqlstate; end;                                              -- GOS02
  begin
    perform public.os_invite_request(tenant, nogrant, app, 'status');
    r := r || ' no_grant=ok';
  exception when others then r := r || ' no_grant=' || sqlstate; end;                                                    -- GOS02

  -- A member who isn't an admin can't ask.
  perform set_config('request.jwt.claims', json_build_object('sub', member, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', member::text, true);
  begin
    perform public.os_invite_request(tenant, subject, app, 'status');
    r := r || ' member=ok';
  exception when others then r := r || ' member=' || sqlstate; end;                                                      -- 42501

  r := r || ' anon=' || has_function_privilege('anon', 'public.os_invite_request(uuid,uuid,text,text)', 'execute')::text;  -- false
  raise exception 'RESULT %', r;
end $t$;
