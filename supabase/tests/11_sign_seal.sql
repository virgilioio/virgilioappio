-- Gio Sign: sealing (build step 11). Rolled back by the final raise exception;
-- read the RESULT line. Expected values are in the comments.

do $t$
declare
  ten uuid; adm uuid; oth uuid; tpl uuid; ec uuid; es uuid;
  s text; n int; ok boolean;
  r text := '';
begin
  select m.user_id, m.tenant_id into adm, ten
  from public.members m join public.profiles p on p.user_id = m.user_id
  where lower(p.email) = 'allan@virgilio.tech' and m.user_status = 'active' limit 1;
  select m.user_id into oth from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role <> 'admin' and m.user_type <> 'platform_admin' limit 1;

  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  insert into public.sign_templates (tenant_id, name, kind, app) values (ten, 'TEST', 'member', 'ats') returning id into tpl;
  -- EC: completed, not sealed. ES: still out for signature.
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id, origin, sender_user_id, sender_name, sender_email, sent_at, completed_at)
  values (ten, 'TEST EC', 'member', 'completed', tpl, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', now() - interval '1 day', now()) returning id into ec;
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id, origin, sender_user_id, sender_name, sender_email, sent_at)
  values (ten, 'TEST ES', 'member', 'sent', tpl, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', now()) returning id into es;

  select count(*) into n from public.sign_seal_claim(es);
  r := 'claim_sent=' || n;                                                      -- 0
  select count(*) into n from public.sign_seal_claim(ec);
  r := r || ' claim=' || n;                                                     -- 1
  select count(*) into n from public.sign_seal_claim(ec);
  r := r || ' claim_again=' || n;                                               -- 0 (being worked on)
  n := public.sign_seal_failed(ec, 'tsa_http_503');
  select seal_error || '/' || (seal_claimed_at is null) into s from public.sign_envelopes where id = ec;
  r := r || ' failed=' || n || ':' || s;                                        -- 1:tsa_http_503/true
  -- four more attempts use them up
  for i in 1..4 loop
    perform public.sign_seal_claim(ec);
    perform public.sign_seal_failed(ec, 'x');
  end loop;
  select count(*) into n from public.sign_seal_claim(ec);
  r := r || ' claim_after_5=' || n;                                             -- 0

  -- a member who isn't an admin can't restart it; an admin can
  perform set_config('request.jwt.claims', json_build_object('sub', oth, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.sign_seal_retry(ec);
    r := r || ' oth_retry=ok';
  exception when sqlstate 'GSN31' then r := r || ' oth_retry=GSN31'; end;       -- GSN31
  begin
    perform public.sign_seal_claim(ec);
    r := r || ' oth_claim=ok';
  exception when insufficient_privilege then r := r || ' oth_claim=denied'; end; -- denied
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'allan@virgilio.tech')::text, true);
  perform public.sign_seal_retry(ec);
  reset role;
  select seal_attempts || '/' || coalesce(seal_error, 'null') into s from public.sign_envelopes where id = ec;
  r := r || ' retry=' || s;                                                     -- 0/null

  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  select count(*) into n from public.sign_seal_claim(ec);
  r := r || ' claim_retry=' || n;                                               -- 1
  perform public.sign_seal_done(ec, ten || '/envelopes/' || ec || '/sealed/x.pdf', 'abc', ten || '/envelopes/' || ec || '/sealed/c.pdf', '{"tsa":"test"}');
  select (sealed_path is not null) || '/' || sealed_sha256 || '/' || (seal_claimed_at is null) into s from public.sign_envelopes where id = ec;
  r := r || ' done=' || s;                                                      -- true/abc/true
  select count(*) into n from public.sign_seal_claim(ec);
  r := r || ' claim_sealed=' || n;                                              -- 0
  begin
    perform public.sign_seal_done(es, 'x', 'y', 'z');
    r := r || ' done_sent=ok';
  exception when sqlstate 'GSN30' then r := r || ' done_sent=GSN30'; end;       -- GSN30

  perform public.sign_mark_delivered(ec, 3);
  perform public.sign_mark_delivered(ec, 3);
  select count(*) into n from public.sign_events where envelope_id = ec and kind = 'delivered';
  select label into s from public.sign_events where envelope_id = ec and kind = 'delivered';
  r := r || ' delivered=' || n || ':' || s;                                     -- 1:Signed copy emailed to 3 people
  select count(*) into n from public.sign_events where envelope_id = ec and kind = 'sealed' and key;
  r := r || ' sealed_event=' || n;                                              -- 1

  -- the identity is service-role only
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform * from public.sign_seal_identity();
    r := r || ' admin_identity=ok';
  exception when insufficient_privilege then r := r || ' admin_identity=denied'; end; -- denied
  reset role;

  raise exception 'RESULT %', r;
end;
$t$;
