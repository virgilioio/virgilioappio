-- Gio Sign: signing and declining (build step 7). Rolled back by the final
-- raise exception; read the RESULT line. Expected values are in the comments.

do $t$
declare
  ten uuid; adm uuid; tpl uuid; e1 uuid; e2 uuid; r1 uuid; r2 uuid; r3 uuid; cc uuid;
  f_sig uuid; f_txt uuid; f_chk uuid; f_date uuid; f_sig2 uuid;
  res jsonb; s text; n int;
  r text := '';
begin
  select m.user_id, m.tenant_id into adm, ten
  from public.members m join public.profiles p on p.user_id = m.user_id
  where lower(p.email) = 'allan@virgilio.tech' and m.user_status = 'active' limit 1;

  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);

  insert into public.sign_templates (tenant_id, name, kind, app) values (ten, 'TEST', 'member', 'ats') returning id into tpl;
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id, origin,
    sender_user_id, sender_name, sender_email, sent_at, ordered)
  values (ten, 'TEST E1', 'member', 'sent', tpl, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', now(), true)
  returning id into e1;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color, status)
  values (ten, e1, 1, 'signer', 'Signer One', 'one@example.com', '#D7C5FB', 'sent') returning id into r1;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color, status)
  values (ten, e1, 2, 'signer', 'Signer Two', 'two@example.com', '#BFE3CF', 'waiting') returning id into r2;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color, status)
  values (ten, e1, 3, 'cc', 'Copy', 'copy@example.com', '#F8D7B0', 'waiting') returning id into cc;
  insert into public.sign_fields (tenant_id, envelope_id, recipient_id, type, page, x, y, w, h, required)
  values (ten, e1, r1, 'signature', 0, 10, 80, 30, 6, true) returning id into f_sig;
  insert into public.sign_fields (tenant_id, envelope_id, recipient_id, type, page, x, y, w, h, required)
  values (ten, e1, r1, 'text', 0, 10, 70, 30, 4, true) returning id into f_txt;
  insert into public.sign_fields (tenant_id, envelope_id, recipient_id, type, page, x, y, w, h, required)
  values (ten, e1, r1, 'checkbox', 0, 10, 60, 3, 3, true) returning id into f_chk;
  insert into public.sign_fields (tenant_id, envelope_id, recipient_id, type, page, x, y, w, h, required)
  values (ten, e1, r1, 'date', 0, 10, 50, 20, 4, true) returning id into f_date;
  insert into public.sign_fields (tenant_id, envelope_id, recipient_id, type, page, x, y, w, h, required)
  values (ten, e1, r2, 'signature', 0, 50, 80, 30, 6, true) returning id into f_sig2;

  r := 'turn1=' || public.sign_is_turn(r1) || ' turn2=' || public.sign_is_turn(r2) || ' turn_cc=' || public.sign_is_turn(cc);  -- true false false

  begin
    perform public.sign_signer_submit(r1, '{}', '{"kind":"type","full_name":"Signer One","initials":"SO","font":"Caveat"}', '1.2.3.4', 'ua');
    r := r || ' unverified=ok';
  exception when sqlstate 'GSN21' then r := r || ' unverified=GSN21'; end;      -- GSN21

  update public.sign_recipients set verified_at = now(), status = 'viewed' where id in (r1);
  update public.sign_recipients set verified_at = now() where id in (r2);

  begin
    perform public.sign_signer_submit(r2, '{}', '{"kind":"type","full_name":"Two","initials":"T","font":"Caveat"}', '1.2.3.4', 'ua');
    r := r || ' early=ok';
  exception when sqlstate 'GSN22' then r := r || ' early=GSN22'; end;           -- GSN22

  begin
    perform public.sign_signer_submit(r1, jsonb_build_object(f_txt::text, 'hello'), null, '1.2.3.4', 'ua');
    r := r || ' nosig=ok';
  exception when sqlstate 'GSN23' then r := r || ' nosig=GSN23'; end;           -- GSN23

  begin
    perform public.sign_signer_submit(r1, jsonb_build_object(f_txt::text, 'hello'),
      '{"kind":"type","full_name":"Signer One","initials":"SO","font":"Caveat"}', '1.2.3.4', 'ua');
    r := r || ' unchecked=ok';
  exception when sqlstate 'GSN24' then r := r || ' unchecked=GSN24'; end;       -- GSN24

  res := public.sign_signer_submit(r1, jsonb_build_object(f_txt::text, 'hello', f_chk::text, 'true'),
      '{"kind":"type","full_name":"Signer One","initials":"SO","font":"Caveat"}', '1.2.3.4', 'Mozilla');
  r := r || ' submit1=' || (res->>'status') || '/' || jsonb_array_length(res->'next') || '/' || ((res->'next'->>0)::uuid = r2);  -- sent/1/true
  select string_agg(type || '=' || coalesce(value, 'null'), ',' order by type) into s from public.sign_fields where recipient_id = r1;
  r := r || ' values=[' || s || ']';                                            -- checkbox=true,date=<today>,signature=signed,text=hello
  select status::text || '/' || (signed_ip = '1.2.3.4'::inet) into s from public.sign_recipients where id = r1;
  r := r || ' r1=' || s;                                                        -- signed/true
  select status::text into s from public.sign_recipients where id = r2;
  r := r || ' r2=' || s;                                                        -- sent
  select count(*) into n from public.sign_signatures where recipient_id = r1;
  r := r || ' sig_rows=' || n;                                                  -- 1

  begin
    perform public.sign_signer_submit(r1, '{}', null, '1.2.3.4', 'ua');
    r := r || ' twice=ok';
  exception when sqlstate 'GSN22' then r := r || ' twice=GSN22'; end;           -- GSN22

  res := public.sign_signer_submit(r2, '{}', '{"kind":"draw","full_name":"Signer Two","initials":"ST","image_path":"x/sig.png"}', '5.6.7.8', 'ua');
  select status::text || '/' || (completed_at is not null) into s from public.sign_envelopes where id = e1;
  r := r || ' submit2=' || (res->>'status') || ' env=' || s;                    -- completed env=completed/true
  select count(*) into n from public.sign_events where envelope_id = e1 and key;
  r := r || ' key_events=' || n;                                                -- 2

  -- Decline on a second envelope.
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id, origin,
    sender_user_id, sender_name, sender_email, sent_at, ordered)
  values (ten, 'TEST E2', 'member', 'sent', tpl, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', now(), false)
  returning id into e2;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color, status, verified_at)
  values (ten, e2, 1, 'signer', 'Three', 'three@example.com', '#D7C5FB', 'viewed', now()) returning id into r3;
  begin
    perform public.sign_signer_decline(r3, 'no', '1.2.3.4', 'ua');
    r := r || ' short=ok';
  exception when sqlstate 'GSN25' then r := r || ' short=GSN25'; end;           -- GSN25
  perform public.sign_signer_decline(r3, 'I took another offer', '1.2.3.4', 'ua');
  select e.status::text || '/' || x.status::text into s from public.sign_envelopes e join public.sign_recipients x on x.envelope_id = e.id where e.id = e2;
  r := r || ' declined=' || s;                                                  -- declined/declined

  -- Signed-in users can't call these.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.sign_signer_decline(r3, 'whatever reason', null, null);
    r := r || ' auth_call=ok';
  exception when sqlstate '42501' then r := r || ' auth_call=42501'; end;       -- 42501

  raise exception 'RESULT %', r;
end $t$;
