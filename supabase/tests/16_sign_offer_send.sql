-- Run after 20261017150000_sign_offer_send inside a transaction that is rolled back.
-- Uses live rows read-only except inside this transaction. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert, select on t_results to authenticated;

-- Allan, as the app would call it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);

do $$
declare
  v_pending uuid := '0feeae2c-8dde-47a4-a202-b728a8280608';  -- chain on the job, approval pending
  v_free uuid := 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e';     -- no chain on its job
  v_tpl uuid;
  v_people jsonb;
  v_env uuid;
  v_gate jsonb;
  v_status text;
  v_err text;
  v_fp text;
begin
  insert into t_results select 'rule: pending approval blocks', (public.offer_can_send(v_pending)->>'reason') = 'pending_approval';
  insert into t_results select 'rule: no chain is ready', (public.offer_can_send(v_free)->>'ok')::boolean;
  insert into t_results select 'rule: unknown offer', (public.offer_can_send(gen_random_uuid())->>'reason') = 'no_offer';
  insert into t_results select 'refusal words', public.offer_send_refusal('pending_approval') like 'Waiting for approval%';

  select id into v_tpl from public.sign_templates where app = 'ats' and kind = 'candidate' and archived_at is null order by created_at limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('role_id', r.id, 'name', 'Test Person ' || r.position, 'email', 'test' || r.position || '@example.com')), '[]')
    into v_people
  from public.sign_recipients r where r.template_id = v_tpl and r.removed_at is null and not r.fixed;

  -- Blocked send: pending approval.
  begin
    perform public.sign_send(v_tpl, 'ats_offer', v_pending, null, v_people);
    insert into t_results select 'send: blocked while pending', false;
  exception when others then
    insert into t_results select 'send: blocked while pending', sqlstate = 'GSN15' and sqlerrm like 'Waiting for approval%';
  end;

  -- Allowed send: no chain.
  v_env := public.sign_send(v_tpl, 'ats_offer', v_free, null, v_people);
  select status into v_status from public.offer_letters where id = v_free;
  insert into t_results select 'send: envelope links the offer', exists (select 1 from public.sign_envelopes e where e.id = v_env and e.offer_id = v_free and e.offer_fingerprint is not null and not e.out_of_date);
  insert into t_results select 'send: offer is now sent', v_status = 'sent';
  insert into t_results select 'send: sent_at set', (select sent_at is not null from public.offer_letters where id = v_free);
  insert into t_results select 'rule: already out', (public.offer_can_send(v_free)->>'reason') = 'already_out';
  insert into t_results select 'preview: gate included', (public.sign_send_preview(v_tpl, 'ats_offer', v_free, null)->'gate'->>'reason') = 'already_out';

  -- The offer is edited while out: out of date only when a used value changes.
  select offer_fingerprint into v_fp from public.sign_envelopes where id = v_env;
  update public.offer_letters set field_values = field_values || '{"unused_scratch_key":"x"}' where id = v_free;
  insert into t_results select 'edit: unrelated field keeps it current', (select not out_of_date from public.sign_envelopes where id = v_env);
end $$;

-- The live template only uses "today", which is never part of the fingerprint,
-- so changing a used value needs a template field on an offer key. Add one
-- (inside this rolled-back transaction) and check again.
reset role;
do $$
declare
  v_free uuid := 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e';
  v_env uuid;
  v_tpl uuid;
  v_ten uuid;
  v_doc uuid;
begin
  select e.id, e.template_id, e.tenant_id into v_env, v_tpl, v_ten from public.sign_envelopes e where e.offer_id = v_free order by created_at desc limit 1;
  select id into v_doc from public.sign_documents where template_id = v_tpl and removed_at is null limit 1;
  insert into public.sign_fields (tenant_id, template_id, type, page, x, y, w, h, required, data_key)
  values (v_ten, v_tpl, 'data', 0, 10, 10, 30, 3, true, 'job_title');
  -- Re-fingerprint as if sent with that field.
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes set offer_fingerprint = public.sign_offer_fingerprint(v_free, v_tpl) where id = v_env;
  perform set_config('gio.sign_rpc', '', true);
  update public.offer_letters set field_values = field_values || '{"job_title":"Changed Title"}' where id = v_free;
  insert into t_results select 'edit: used value marks it out of date', (select out_of_date from public.sign_envelopes where id = v_env);

  -- Signed by everyone → offer accepted; voided → back to draft (no chain).
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes set status = 'completed', completed_at = now() where id = v_env;
  insert into t_results select 'signed: offer accepted', (select status = 'accepted' from public.offer_letters where id = v_free);
  insert into t_results select 'rule: already signed', (public.offer_can_send(v_free)->>'reason') = 'already_signed';
  update public.sign_envelopes set status = 'voided', voided_at = now(), void_reason = 'test' where id = v_env;
  perform set_config('gio.sign_rpc', '', true);
  insert into t_results select 'voided: offer back to draft', (select status = 'draft' from public.offer_letters where id = v_free);
  insert into t_results select 'voided: can send again', (public.offer_can_send(v_free)->>'ok')::boolean;
end $$;

-- A template linked to a form can't be sent as "another agreement", and
-- a save with a field the form doesn't have is refused.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);
do $$
declare
  v_tpl uuid; v_ten uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  v_form uuid := '5cd4d4c1-a520-4936-9489-11d7758fab91';
  v_t jsonb; v_doc record; v_role record;
begin
  select id into v_tpl from public.sign_templates where app = 'ats' and kind = 'candidate' and archived_at is null order by created_at limit 1;
  select * into v_doc from public.sign_documents where template_id = v_tpl and removed_at is null order by position limit 1;
  select * into v_role from public.sign_recipients where template_id = v_tpl and removed_at is null and role = 'signer' order by position limit 1;
  v_t := jsonb_build_object(
    'id', gen_random_uuid(), 'tenant_id', v_ten, 'name', 'Test offer template', 'kind', 'candidate', 'app', 'ats',
    'offer_form_id', v_form, 'subject', 's', 'body', 'b',
    'docs', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'name', v_doc.name, 'storage_path', v_doc.storage_path, 'page_count', v_doc.page_count, 'page_sizes', v_doc.page_sizes, 'size_bytes', v_doc.size_bytes, 'sha256', v_doc.sha256)),
    'roles', jsonb_build_array(jsonb_build_object('id', '11111111-1111-4111-8111-111111111111', 'label', 'Candidate', 'role', 'signer', 'fixed', false, 'color', '#D7C5FB')),
    'fields', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'type', 'signature', 'rid', '11111111-1111-4111-8111-111111111111', 'page', 0, 'x', 10, 'y', 80, 'w', 30, 'h', 6),
      jsonb_build_object('id', gen_random_uuid(), 'type', 'data', 'data_key', 'base_salary', 'page', 0, 'x', 10, 'y', 20, 'w', 30, 'h', 3),
      jsonb_build_object('id', gen_random_uuid(), 'type', 'data', 'data_key', 'not_a_form_field', 'page', 0, 'x', 10, 'y', 30, 'w', 30, 'h', 3)));
  begin
    perform public.sign_save_template(v_t);
    insert into t_results select 'save: unknown field refused', false;
  exception when others then
    insert into t_results select 'save: unknown field refused', sqlerrm like '%not_a_form_field%';
  end;
  v_t := jsonb_set(v_t, '{fields}', (v_t->'fields') - 2);
  perform public.sign_save_template(v_t);
  insert into t_results select 'save: linked template saved', exists (select 1 from public.sign_templates where id = (v_t->>'id')::uuid and offer_form_id = v_form);
  begin
    perform public.sign_send_preview((v_t->>'id')::uuid, 'candidate', '26226545-59d7-44b6-8de6-cf9a7e4e51d5', '7d16b23e-0ff0-4583-8ff7-19cdb6fb6e07');
    insert into t_results select 'preview: offer template not as other agreement', false;
  exception when others then
    insert into t_results select 'preview: offer template not as other agreement', sqlstate = 'GSN16';
  end;
  insert into t_results select 'preview: offer values listed',
    exists (select 1 from jsonb_array_elements(public.sign_send_preview((v_t->>'id')::uuid, 'ats_offer', 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e', null)->'used') u
            where u->>'key' = 'base_salary' and u->>'label' = 'Base Salary' and u->>'value' like 'MXN %');
end $$;
reset role;

select check_name as check, ok from t_results;
