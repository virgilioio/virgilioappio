-- Gio Sign: RLS and guard tests (build step 1).
-- Runs against a real database inside one transaction and always ends with
-- raise exception 'RESULT ...', so nothing it creates is kept. Run it with
-- execute_sql (or psql) and read the RESULT line: every check prints k=v and
-- the expected value is written next to it in the comments.
--
-- Users are picked from live data: an admin, a non-admin member assigned to a
-- job (the "TA"), and a non-admin member who is not on that job ("other").

do $t$
declare
  ten uuid; adm uuid; ta uuid; oth uuid; job uuid; cand uuid;
  oth_email text;
  t_ats uuid; t_sales uuid; t_old uuid; role_id uuid;
  e1 uuid; e2 uuid; e3 uuid; r_e2 uuid; f_e2 uuid; r_e3 uuid;
  r text := '';
  n int; ok boolean; s text;
begin
  -- ---------- pick users ----------
  select m.user_id, m.tenant_id into adm, ten
  from public.members m join public.profiles p on p.user_id = m.user_id
  where lower(p.email) = 'allan@virgilio.tech' and m.user_status = 'active'
  limit 1;

  select ja.user_id, ja.job_id into ta, job
  from public.job_assignments ja
  join public.members m on m.user_id = ja.user_id and m.tenant_id = ten
    and m.user_status = 'active' and m.system_role <> 'admin' and m.user_type <> 'platform_admin'
  where ja.deleted_at is null
  limit 1;

  select m.user_id, lower(p.email) into oth, oth_email
  from public.members m join public.profiles p on p.user_id = m.user_id
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role <> 'admin'
    and m.user_type <> 'platform_admin' and m.user_id <> ta
    and not exists (select 1 from public.job_assignments ja where ja.user_id = m.user_id and ja.job_id = job and ja.deleted_at is null)
  limit 1;

  select c.id into cand from public.candidates c where c.tenant_id = ten limit 1;

  r := 'users=' || (adm is not null and ta is not null and oth is not null and cand is not null);

  -- ---------- setup as the service role ----------
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);

  insert into public.sign_templates (tenant_id, name, kind, app, created_by)
  values (ten, 'TEST offer', 'candidate', 'ats', adm) returning id into t_ats;
  insert into public.sign_templates (tenant_id, name, kind, app, created_by)
  values (ten, 'TEST MSA', 'customer', 'sales', adm) returning id into t_sales;
  insert into public.sign_templates (tenant_id, name, kind, app, created_by, archived_at)
  values (ten, 'TEST old', 'candidate', 'ats', adm, now()) returning id into t_old;
  insert into public.sign_recipients (tenant_id, template_id, position, label, color)
  values (ten, t_ats, 1, 'Candidate', '#D7C5FB') returning id into role_id;

  -- E1: candidate offer on the TA's job, sent.
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id,
    ats_job_id, ats_candidate_id, origin, sender_user_id, sender_name, sender_email, sent_at, created_by)
  values (ten, 'TEST E1', 'candidate', 'sent', t_ats, 'candidate', cand, job, cand, 'ats', adm, 'Allan', 'allan@virgilio.tech', now(), adm)
  returning id into e1;
  -- E2: admin draft (member agreement).
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id,
    origin, sender_user_id, sender_name, sender_email, created_by)
  values (ten, 'TEST E2', 'member', 'draft', t_ats, 'member', adm, 'ats', adm, 'Allan', 'allan@virgilio.tech', adm)
  returning id into e2;
  insert into public.sign_recipients (tenant_id, envelope_id, position, name, email, color)
  values (ten, e2, 1, 'Someone', 'someone@example.com', '#D7C5FB') returning id into r_e2;
  insert into public.sign_fields (tenant_id, envelope_id, recipient_id, type, page, x, y, w, h)
  values (ten, e2, r_e2, 'text', 0, 10, 10, 20, 4) returning id into f_e2;
  insert into public.sign_recipient_secrets (recipient_id, token_hash) values (r_e2, 'TEST-hash');
  -- E3: member agreement where "other" is a recipient.
  insert into public.sign_envelopes (tenant_id, title, kind, status, template_id, source_type, source_id,
    origin, sender_user_id, sender_name, sender_email, sent_at, created_by)
  values (ten, 'TEST E3', 'member', 'sent', t_ats, 'member', oth, 'ats', adm, 'Allan', 'allan@virgilio.tech', now(), adm)
  returning id into e3;
  insert into public.sign_recipients (tenant_id, envelope_id, position, name, email, color)
  values (ten, e3, 1, 'Other', oth_email, '#BFE3CF') returning id into r_e3;
  insert into public.sign_events (tenant_id, envelope_id, kind, label) values (ten, e1, 'sent', 'Sent');

  -- ---------- as the admin ----------
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'allan@virgilio.tech')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.sign_envelopes where id in (e1, e2, e3);
  r := r || ' adm_sees=' || n;                                   -- 3
  select count(*) into n from public.sign_templates where id in (t_ats, t_sales, t_old);
  r := r || ' adm_tpl=' || n;                                    -- 3
  begin
    insert into public.sign_templates (tenant_id, name, kind, app) values (ten, 'TEST new', 'member', 'ats');
    r := r || ' adm_tpl_new=ok';                                 -- ok
  exception when others then r := r || ' adm_tpl_new=' || sqlstate; end;
  update public.sign_envelopes set title = 'TEST E2 renamed' where id = e2;
  get diagnostics n = row_count;
  r := r || ' adm_edit_draft=' || n;                             -- 1
  begin
    update public.sign_envelopes set status = 'sent' where id = e2;
    r := r || ' adm_status=allowed';
  exception when others then r := r || ' adm_status=' || sqlstate; end;   -- GSN03
  begin
    update public.sign_recipients set status = 'signed' where id = r_e2;
    r := r || ' adm_sign_state=allowed';
  exception when others then r := r || ' adm_sign_state=' || sqlstate; end; -- GSN06
  update public.sign_fields set value = 'typed' where id = f_e2;
  r := r || ' field_value=' || coalesce((select value from public.sign_fields where id = f_e2), 'null'); -- null
  begin
    perform 1 from public.sign_recipient_secrets limit 1;
    r := r || ' adm_secrets=readable';
  exception when others then r := r || ' adm_secrets=' || sqlstate; end;  -- 42501
  update public.sign_envelopes set title = 'x' where id = e1;
  get diagnostics n = row_count;
  r := r || ' adm_edit_sent=' || n;                              -- 0

  -- Undo send inside the window.
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  update public.sign_envelopes set status = 'queued', dispatch_at = now() + interval '5 seconds' where id = e2;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'allan@virgilio.tech')::text, true);
  execute 'set local role authenticated';
  ok := public.sign_undo_send(e2);
  r := r || ' undo=' || ok || '/' || (select status from public.sign_envelopes where id = e2); -- true/draft

  -- ---------- as the TA on the job ----------
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ta, 'role', 'authenticated', 'email', 'ta@test.invalid')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.sign_envelopes where id in (e1, e2, e3);
  r := r || ' ta_sees=' || n;                                    -- 1 (E1)
  select count(*) into n from public.sign_envelopes where id = e1;
  r := r || ' ta_e1=' || n;                                      -- 1
  select count(*) into n from public.sign_templates where id in (t_ats, t_sales, t_old);
  r := r || ' ta_tpl=' || n;                                     -- 1 (live ATS template)
  select count(*) into n from public.sign_recipients where id = role_id;
  r := r || ' ta_tpl_roles=' || n;                               -- 1
  select count(*) into n from public.sign_events where envelope_id = e1;
  r := r || ' ta_events=' || n;                                  -- 1
  begin
    insert into public.sign_templates (tenant_id, name, kind, app) values (ten, 'TEST ta', 'candidate', 'ats');
    r := r || ' ta_tpl_new=allowed';
  exception when others then r := r || ' ta_tpl_new=' || sqlstate; end;   -- 42501
  begin
    insert into public.sign_envelopes (tenant_id, title, kind, template_id, source_type, source_id, ats_candidate_id, origin, sender_name, sender_email)
    values (ten, 'TEST ta env', 'candidate', t_ats, 'candidate', cand, cand, 'ats', 'TA', 'ta@test.invalid');
    r := r || ' ta_env_new=allowed';
  exception when others then r := r || ' ta_env_new=' || sqlstate; end;   -- GSN02 or 42501
  update public.sign_envelopes set title = 'x' where id = e1;
  get diagnostics n = row_count;
  r := r || ' ta_edit=' || n;                                    -- 0
  begin
    insert into public.sign_events (tenant_id, envelope_id, kind, label) values (ten, e1, 'sent', 'forged');
    r := r || ' ta_event_insert=allowed';
  exception when others then r := r || ' ta_event_insert=' || sqlstate; end; -- 42501
  begin
    perform public.sign_set_draft_removed(e2, true);
    r := r || ' ta_remove_draft=allowed';
  exception when others then r := r || ' ta_remove_draft=' || sqlstate; end; -- GSN07
  ok := public.sign_undo_send(e1);
  r := r || ' ta_undo_other=' || ok;                             -- false

  -- ---------- as a member not on the job ----------
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', oth, 'role', 'authenticated', 'email', oth_email)::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.sign_envelopes where id in (e1, e2, e3);
  r := r || ' oth_sees=' || n;                                   -- 1 (E3, as recipient)
  select count(*) into n from public.sign_envelopes where id = e3;
  r := r || ' oth_e3=' || n;                                     -- 1

  -- ---------- anonymous ----------
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin
    select count(*) into n from public.sign_envelopes where id in (e1, e2, e3);
    r := r || ' anon_sees=' || n;                                -- 0 (or denied)
  exception when others then r := r || ' anon_sees=' || sqlstate; end;
  begin
    select count(*) into n from public.sign_recipient_secrets;
    r := r || ' anon_secrets=' || n;
  exception when others then r := r || ' anon_secrets=' || sqlstate; end; -- 42501

  execute 'reset role';
  raise exception 'RESULT %', r;
end
$t$;
