-- sign_remind_request: an admin can remind a Gio Sales agreement from the ATS.
-- Runs inside a block that ends by raising its result, so nothing it writes is kept.
do $t$
declare
  ten uuid; adm uuid; oth uuid; org uuid := gen_random_uuid();
  t_sales uuid; t_ats uuid;
  e_sales uuid; e_sales2 uuid; e_done uuid; e_ats uuid;
  r_signed uuid; r_turn uuid; r_cc uuid; r_wait uuid; r_ats uuid; r_s2 uuid;
  r text := '';
  got uuid[]; j jsonb;
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

  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('gio.sign_rpc', 'on', true);
  insert into public.sign_templates (tenant_id, name, kind, app, created_by)
  values (ten, 'TEST remind sales', 'customer', 'sales', adm) returning id into t_sales;
  insert into public.sign_templates (tenant_id, name, kind, app, created_by)
  values (ten, 'TEST remind ats', 'candidate', 'ats', adm) returning id into t_ats;

  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id,
    origin, sender_sales_user_id, sales_org_id, sender_name, sender_email, sent_at, created_by)
  values (ten, 'TEST sales', 'customer', 'sent', t_sales, 'deal', gen_random_uuid(), 'sales', gen_random_uuid(), org, 'A rep', 'rep@virgilio.tech', now(), adm)
  returning id into e_sales;
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id,
    origin, sender_sales_user_id, sales_org_id, sender_name, sender_email, sent_at, created_by)
  values (ten, 'TEST sales 2', 'customer', 'sent', t_sales, 'deal', gen_random_uuid(), 'sales', gen_random_uuid(), org, 'A rep', 'rep@virgilio.tech', now(), adm)
  returning id into e_sales2;
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id,
    origin, sender_sales_user_id, sales_org_id, sender_name, sender_email, sent_at, completed_at, created_by)
  values (ten, 'TEST sales done', 'customer', 'completed', t_sales, 'deal', gen_random_uuid(), 'sales', gen_random_uuid(), org, 'A rep', 'rep@virgilio.tech', now(), now(), adm)
  returning id into e_done;
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id,
    origin, sender_user_id, sender_name, sender_email, sent_at, created_by)
  values (ten, 'TEST ats', 'member', 'sent', t_ats, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', now(), adm)
  returning id into e_ats;

  -- The Gio Sales agreement: one signed, one whose turn it is, one on copy, one still waiting.
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color, status, signed_at)
  values (ten, e_sales, 1, 'signer', 'Client', 'client@example.com', '#D7C5FB', 'signed', now()) returning id into r_signed;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color, status)
  values (ten, e_sales, 2, 'signer', 'Second', 'second@example.com', '#D7C5FB', 'sent') returning id into r_turn;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color, status)
  values (ten, e_sales, 3, 'cc', 'Copy', 'copy@example.com', '#D7C5FB', 'waiting') returning id into r_cc;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color, status)
  values (ten, e_sales, 4, 'signer', 'Later', 'later@example.com', '#D7C5FB', 'waiting') returning id into r_wait;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color, status)
  values (ten, e_ats, 1, 'signer', 'Someone', 'someone@example.com', '#D7C5FB', 'sent') returning id into r_ats;
  insert into public.sign_recipients (tenant_id, envelope_id, position, role, name, email, color, status)
  values (ten, e_sales2, 1, 'signer', 'Other', 'other@example.com', '#D7C5FB', 'viewed') returning id into r_s2;
  insert into public.sign_recipient_secrets (recipient_id, token_hash, token_issued_at, token_expires_at)
  select x, md5(x::text), now(), now() + interval '7 days' from unnest(array[r_signed, r_turn, r_ats, r_s2]) x
  on conflict (recipient_id) do update set token_hash = excluded.token_hash, token_issued_at = excluded.token_issued_at, token_expires_at = excluded.token_expires_at;
  perform set_config('gio.sign_rpc', 'off', true);

  -- An admin, from the ATS.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'allan@virgilio.tech')::text, true);
  select array_agg(x.recipient_id) into got from public.sign_remind_request(e_sales) x;
  r := r || ' admin_reminds_sales=' || (got = array[r_turn]);
  r := r || ' signed_copy_and_waiting_skipped=' || (not (r_signed = any(got)) and not (r_cc = any(got)) and not (r_wait = any(got)));
  r := r || ' stamped=' || ((select last_reminded_at from public.sign_envelopes where id = e_sales) is not null);
  begin
    perform public.sign_remind_request(e_sales);
    r := r || ' once_an_hour=false';
  exception when others then
    r := r || ' once_an_hour=' || (sqlstate = 'GSN26');
  end;
  begin
    perform public.sign_remind_request(e_done);
    r := r || ' finished_refused=false';
  exception when others then
    r := r || ' finished_refused=' || (sqlstate = 'GSN07');
  end;
  begin
    perform public.sign_remind_request(gen_random_uuid());
    r := r || ' unknown_refused=false';
  exception when others then
    r := r || ' unknown_refused=' || (sqlstate = '42501');
  end;
  select array_agg(x.recipient_id) into got from public.sign_remind_request(e_ats) x;
  r := r || ' admin_reminds_ats=' || (got = array[r_ats]);

  -- A member who is neither the sender nor an admin.
  perform set_config('request.jwt.claims', json_build_object('sub', oth, 'role', 'authenticated')::text, true);
  begin
    perform public.sign_remind_request(e_sales2);
    r := r || ' member_refused_sales=false';
  exception when others then
    r := r || ' member_refused_sales=' || (sqlstate = '42501' and sqlerrm = 'Only the sender or an admin can send a reminder.');
  end;
  begin
    update public.sign_envelopes set last_reminded_at = null where id = e_ats;
  exception when others then null;
  end;
  begin
    perform public.sign_remind_request(e_ats);
    r := r || ' member_refused_ats=false';
  exception when others then
    r := r || ' member_refused_ats=' || (sqlstate = '42501');
  end;

  -- Gio Sales' own reminder still works, for its own workspace only.
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  j := public.sign_sales_manage(e_sales2, org, 'remind', null, 'A rep', 'rep@virgilio.tech');
  r := r || ' sales_path_works=' || (j -> 'recipients' = to_jsonb(array[r_s2]));
  begin
    perform public.sign_sales_manage(e_sales2, gen_random_uuid(), 'remind', null, 'A rep', 'rep@virgilio.tech');
    r := r || ' other_workspace_refused=false';
  exception when others then
    r := r || ' other_workspace_refused=' || (sqlstate = 'GSN07');
  end;

  r := r || ' anon_cant_call=' || (not has_function_privilege('anon', 'public.sign_remind_request(uuid)', 'execute'));

  raise exception 'RESULT %', r;
end $t$;
