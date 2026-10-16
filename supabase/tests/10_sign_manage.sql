-- Gio Sign: managing a sent envelope (build step 9). Rolled back by the final
-- raise exception; read the RESULT line. Expected values are in the comments.

do $t$
declare
  ten uuid; adm uuid; oth uuid; tpl uuid; es uuid; ev uuid; ec uuid; ex uuid; r1 uuid; r2 uuid; rv uuid; rx uuid;
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
  -- ES: scheduled. EV: sent (to void). EC: sent, in order (to correct and remind). EX: sent, past expiry.
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id, origin, sender_user_id, sender_name, sender_email, scheduled_at)
  values (ten, 'TEST ES', 'member', 'scheduled', tpl, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', now() + interval '1 day') returning id into es;
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id, origin, sender_user_id, sender_name, sender_email, sent_at, expires_at)
  values (ten, 'TEST EV', 'member', 'sent', tpl, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', now(), now() + interval '14 days') returning id into ev;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color, status) values (ten, ev, 1, 'signer', 'V', 'v@example.com', '#D7C5FB', 'sent') returning id into rv;
  insert into public.sign_recipient_secrets (recipient_id, token_hash, token_issued_at) values (rv, 'TEST-v', now());
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id, origin, sender_user_id, sender_name, sender_email, sent_at, expires_at, reminder_days, ordered)
  values (ten, 'TEST EC', 'member', 'sent', tpl, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', now() - interval '3 days', now() + interval '2 days', 2, true) returning id into ec;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color, status) values (ten, ec, 1, 'signer', 'One', 'one@example.com', '#D7C5FB', 'viewed') returning id into r1;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color, status) values (ten, ec, 2, 'signer', 'Two', 'two@example.com', '#BFE3CF', 'waiting') returning id into r2;
  insert into public.sign_recipient_secrets (recipient_id, token_hash, token_issued_at) values (r1, 'TEST-1', now() - interval '3 days');
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id, origin, sender_user_id, sender_name, sender_email, sent_at, expires_at)
  values (ten, 'TEST EX', 'member', 'sent', tpl, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', now() - interval '20 days', now() - interval '1 minute') returning id into ex;

  -- service-side jobs
  select count(*) into n from public.sign_reminders_due() d where d.recipient_id = r1;
  r := 'remind_due=' || n;                                                      -- 1
  ok := public.sign_rotate_link(r1, 'TEST-1b');
  select token_hash || '/' || token_hash_prev into s from public.sign_recipient_secrets where recipient_id = r1;
  r := r || ' rotate=' || ok || ':' || s;                                       -- true:TEST-1b/TEST-1
  select count(*) into n from public.sign_reminders_due() d where d.recipient_id = r1;
  r := r || ' remind_due_after=' || n;                                          -- 0
  select count(*) into n from public.sign_expire_due() d where d.envelope_id in (ec, ev, ex);
  select status::text into s from public.sign_envelopes where id = ex;
  r := r || ' expired=' || n || '/' || s;                                       -- 1/expired
  select count(*) into n from public.sign_expiring_claim() d where d.envelope_id = ec;
  r := r || ' expiring=' || n;                                                  -- 1
  select count(*) into n from public.sign_expiring_claim() d where d.envelope_id = ec;
  r := r || ' expiring_again=' || n;                                            -- 0

  -- someone else can't manage
  perform set_config('request.jwt.claims', json_build_object('sub', oth, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.sign_void(ev, 'not mine');
    r := r || ' oth_void=ok';
  exception when sqlstate 'GSN07' then r := r || ' oth_void=GSN07'; end;       -- GSN07

  -- the sender
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'allan@virgilio.tech')::text, true);
  perform public.sign_send_now(es);
  select status::text || '/' || (dispatch_at is not null) into s from public.sign_envelopes where id = es;
  r := r || ' send_now=' || s;                                                  -- queued/true
  begin
    perform public.sign_void(ev, 'x');
    r := r || ' short_reason=ok';
  exception when sqlstate 'GSN25' then r := r || ' short_reason=GSN25'; end;    -- GSN25
  select count(*) into n from public.sign_void(ev, 'Wrong salary, sending a new one');
  select status::text || '/' || (void_reason is not null) into s from public.sign_envelopes where id = ev;
  r := r || ' void=' || n || ':' || s;                                          -- 1:voided/true
  reset role;
  select coalesce(token_hash, 'null') into s from public.sign_recipient_secrets where recipient_id = rv;
  set local role authenticated;
  r := r || ' link_dead=' || s;                                                 -- null

  select count(*) into n from public.sign_remind_request(ec);
  r := r || ' remind=' || n;                                                    -- 1
  begin
    perform public.sign_remind_request(ec);
    r := r || ' remind_again=ok';
  exception when sqlstate 'GSN26' then r := r || ' remind_again=GSN26'; end;    -- GSN26

  n := public.sign_correct(ec, jsonb_build_array(jsonb_build_object('recipient_id', r1, 'name', 'Uno', 'email', 'UNO@example.com')), now() + interval '10 days');
  select name || '/' || email || '/' || status::text || '/' || (verified_at is null) into s from public.sign_recipients where id = r1;
  r := r || ' correct=' || n || ':' || s;                                       -- 2:Uno/uno@example.com/sent/true
  reset role;
  select coalesce(token_hash, 'null') || '/' || coalesce(token_issued_at::text, 'null') into s from public.sign_recipient_secrets where recipient_id = r1;
  set local role authenticated;
  r := r || ' relink=' || s;                                                    -- null/null
  select count(*) into n from public.sign_events where envelope_id = ec and kind = 'corrected';
  r := r || ' corrected_events=' || n;                                          -- 2
  begin
    perform public.sign_correct(ec, jsonb_build_array(jsonb_build_object('recipient_id', r2, 'name', 'Dos', 'email', 'uno@example.com')));
    r := r || ' dup=ok';
  exception when sqlstate 'GSN13' then r := r || ' dup=GSN13'; end;             -- GSN13
  begin
    perform public.sign_correct(ec, '[]'::jsonb, now() + interval '200 days');
    r := r || ' far=ok';
  exception when sqlstate 'GSN08' then r := r || ' far=GSN08'; end;             -- GSN08
  begin
    perform public.sign_rotate_link(r1, 'x');
    r := r || ' auth_rotate=ok';
  exception when sqlstate '42501' then r := r || ' auth_rotate=42501'; end;     -- 42501

  raise exception 'RESULT %', r;
end $t$;
