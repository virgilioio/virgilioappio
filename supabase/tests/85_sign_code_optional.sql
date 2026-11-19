-- Run after 20261117163905_sign_code_optional. One transaction that always ends
-- with raise exception 'RESULT ...', so nothing it makes is kept. Every k=v is
-- expected to read true.
--
-- The email code is a setting: a template's default that envelopes copy, changed
-- on a sent envelope by the sender or an admin (Gio Sales envelopes included),
-- never once an envelope has finished, and every change is in the history.

do $t$
declare
  ten uuid; adm uuid; oth uuid;
  t_on uuid; t_off uuid;
  e_on uuid; e_off uuid; e_done uuid; e_sales uuid; rcp uuid;
  r text := '';
  n int; v boolean; s text;
begin
  select m.user_id, m.tenant_id into adm, ten
  from public.members m join public.profiles p on p.user_id = m.user_id
  where lower(p.email) = 'allan@virgilio.tech' and m.user_status = 'active'
  limit 1;
  select m.user_id into oth
  from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role <> 'admin'
    and m.user_type not in ('platform_admin', 'external') and m.user_id <> adm
  limit 1;
  r := 'people=' || (adm is not null and oth is not null);

  -- Setup as the service role.
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  insert into public.sign_templates (tenant_id, name, kind, app, created_by)
  values (ten, 'TEST code on', 'customer', 'sales', adm) returning id into t_on;
  insert into public.sign_templates (tenant_id, name, kind, app, created_by)
  values (ten, 'TEST code off', 'candidate', 'ats', adm) returning id into t_off;
  r := r || ' template_default_off=' || not (select require_code from public.sign_templates where id = t_off);
  update public.sign_templates set require_code = true where id = t_on;

  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id,
    origin, sender_user_id, sender_name, sender_email, sent_at, created_by)
  values (ten, 'TEST on', 'member', 'sent', t_on, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', now(), adm)
  returning id into e_on;
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id,
    origin, sender_user_id, sender_name, sender_email, sent_at, created_by)
  values (ten, 'TEST off', 'member', 'sent', t_off, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', now(), adm)
  returning id into e_off;
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id,
    origin, sender_user_id, sender_name, sender_email, sent_at, completed_at, created_by)
  values (ten, 'TEST done', 'member', 'completed', t_on, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', now(), now(), adm)
  returning id into e_done;
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id,
    origin, sender_sales_user_id, sales_org_id, sender_name, sender_email, sent_at, created_by)
  values (ten, 'TEST sales', 'customer', 'sent', t_on, 'deal', gen_random_uuid(), 'sales', gen_random_uuid(), gen_random_uuid(), 'A rep', 'rep@virgilio.tech', now(), adm)
  returning id into e_sales;
  insert into public.sign_recipients (tenant_id, envelope_id, position, name, email, color)
  values (ten, e_off, 1, 'Someone', 'someone@example.com', '#D7C5FB') returning id into rcp;

  r := r || ' copies_on=' || (select require_code from public.sign_envelopes where id = e_on)
         || ' copies_off=' || (not (select require_code from public.sign_envelopes where id = e_off));

  -- How a signer got in: code or link only.
  update public.sign_recipients set verified_by = 'link' where id = rcp;
  update public.sign_recipients set verified_by = 'code' where id = rcp;
  begin
    update public.sign_recipients set verified_by = 'sms' where id = rcp;
    r := r || ' verified_by_checked=false';
  exception when check_violation then
    r := r || ' verified_by_checked=true';
  end;

  -- As the admin (also the sender).
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'allan@virgilio.tech')::text, true);
  v := public.sign_set_require_code(e_on, false);
  r := r || ' turned_off=' || (v = false and not (select require_code from public.sign_envelopes where id = e_on));
  select count(*) into n from public.sign_events where envelope_id = e_on and kind = 'corrected' and label like 'Email code turned off%' and actor_user_id = adm;
  r := r || ' history_written=' || (n = 1);
  v := public.sign_set_require_code(e_on, false);
  select count(*) into n from public.sign_events where envelope_id = e_on and kind = 'corrected';
  r := r || ' same_value_no_new_line=' || (n = 1);
  v := public.sign_set_require_code(e_on, true);
  r := r || ' turned_back_on=' || (select require_code from public.sign_envelopes where id = e_on);
  v := public.sign_set_require_code(e_sales, false);
  r := r || ' admin_changes_sales_envelope=' || not (select require_code from public.sign_envelopes where id = e_sales);
  begin
    perform public.sign_set_require_code(e_done, false);
    r := r || ' finished_refused=false';
  exception when others then
    r := r || ' finished_refused=' || (sqlstate = 'GSN32');
  end;
  begin
    perform public.sign_set_require_code(e_on, null);
    r := r || ' null_refused=false';
  exception when others then
    r := r || ' null_refused=' || (sqlstate = 'GSN12');
  end;
  v := public.sign_template_set_require_code(t_off, true);
  r := r || ' template_set=' || (select require_code from public.sign_templates where id = t_off);

  -- As a member who isn't the sender or an admin.
  perform set_config('request.jwt.claims', json_build_object('sub', oth, 'role', 'authenticated')::text, true);
  begin
    perform public.sign_set_require_code(e_off, true);
    r := r || ' member_refused=false';
  exception when others then
    r := r || ' member_refused=' || (sqlstate = '42501');
  end;
  begin
    perform public.sign_template_set_require_code(t_off, false);
    r := r || ' member_template_refused=false';
  exception when others then
    r := r || ' member_template_refused=' || (sqlstate = '42501');
  end;

  r := r || ' anon_cant_call=' || (not has_function_privilege('anon', 'public.sign_set_require_code(uuid, boolean)', 'execute'))
         || ' anon_cant_set_template=' || (not has_function_privilege('anon', 'public.sign_template_set_require_code(uuid, boolean)', 'execute'));

  raise exception 'RESULT %', r;
end $t$;
