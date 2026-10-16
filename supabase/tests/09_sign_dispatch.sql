-- Gio Sign: dispatch and invitations (build step 8). Rolled back by the final
-- raise exception; read the RESULT line. Expected values are in the comments.

do $t$
declare
  ten uuid; adm uuid; tpl uuid; e1 uuid; e2 uuid; e3 uuid; r1 uuid; r2 uuid; cc uuid; u1 uuid; u2 uuid;
  s text; n int; ok boolean;
  r text := '';
begin
  select m.user_id, m.tenant_id into adm, ten
  from public.members m join public.profiles p on p.user_id = m.user_id
  where lower(p.email) = 'allan@virgilio.tech' and m.user_status = 'active' limit 1;
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);

  insert into public.sign_templates (tenant_id, name, kind, app) values (ten, 'TEST', 'member', 'ats') returning id into tpl;
  -- E1: queued, Undo window over, in order.
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id, origin,
    sender_user_id, sender_name, sender_email, ordered, expiry_days, dispatch_at)
  values (ten, 'TEST E1', 'member', 'queued', tpl, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', true, 14, now() - interval '1 second')
  returning id into e1;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color) values (ten, e1, 1, 'signer', 'One', 'one@example.com', '#D7C5FB') returning id into r1;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color) values (ten, e1, 2, 'signer', 'Two', 'two@example.com', '#BFE3CF') returning id into r2;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color) values (ten, e1, 3, 'cc', 'Copy', 'copy@example.com', '#F8D7B0') returning id into cc;
  -- E2: scheduled for tomorrow (not due). E3: queued, in any order, Undo window still open... then due.
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id, origin,
    sender_user_id, sender_name, sender_email, scheduled_at)
  values (ten, 'TEST E2', 'member', 'scheduled', tpl, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', now() + interval '1 day')
  returning id into e2;
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id, origin,
    sender_user_id, sender_name, sender_email, ordered, dispatch_at)
  values (ten, 'TEST E3', 'member', 'queued', tpl, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', false, now() + interval '4 seconds')
  returning id into e3;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color) values (ten, e3, 1, 'signer', 'U1', 'u1@example.com', '#D7C5FB') returning id into u1;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color) values (ten, e3, 2, 'signer', 'U2', 'u2@example.com', '#BFE3CF') returning id into u2;

  select count(*) into n from public.sign_claim_due() c where c.envelope_id in (e1, e2, e3);
  r := 'claimed=' || n;                                                         -- 1 (E1 only)
  select status::text || '/' || (expires_at > now() + interval '13 days') || '/' || (dispatch_at is null) into s from public.sign_envelopes where id = e1;
  r := r || ' e1=' || s;                                                        -- sent/true/true
  select string_agg(status::text, ',' order by position) into s from public.sign_recipients where envelope_id = e1;
  r := r || ' e1_people=' || s;                                                 -- sent,waiting,waiting
  select status::text into s from public.sign_envelopes where id = e2;
  r := r || ' e2=' || s;                                                        -- scheduled
  select count(*) into n from public.sign_claim_due() c where c.envelope_id = e1;
  r := r || ' reclaim=' || n;                                                   -- 0

  update public.sign_envelopes set dispatch_at = now() - interval '1 second' where id = e3;
  perform public.sign_claim_due();
  select string_agg(status::text, ',' order by position) into s from public.sign_recipients where envelope_id = e3;
  r := r || ' e3_people=' || s;                                                 -- sent,sent

  select count(*) into n from public.sign_pending_invites() p where p.envelope_id in (e1, e3);
  r := r || ' pending=' || n;                                                   -- 3
  ok := public.sign_claim_invite(r1, 'TEST-hash-1', now() + interval '14 days');
  r := r || ' claim=' || ok;                                                    -- true
  ok := public.sign_claim_invite(r1, 'TEST-hash-2', now() + interval '14 days');
  r := r || ' claim_again=' || ok;                                              -- false
  select token_hash into s from public.sign_recipient_secrets where recipient_id = r1;
  r := r || ' kept=' || s;                                                      -- TEST-hash-1
  perform public.sign_release_invite(r1);
  select count(*) into n from public.sign_pending_invites() p where p.recipient_id = r1;
  r := r || ' released_pending=' || n;                                          -- 1
  ok := public.sign_claim_invite(r1, 'TEST-hash-3', now() + interval '14 days');
  r := r || ' reclaim_invite=' || ok;                                           -- true

  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.sign_claim_due();
    r := r || ' auth=ok';
  exception when sqlstate '42501' then r := r || ' auth=42501'; end;            -- 42501

  raise exception 'RESULT %', r;
end $t$;
