-- Run after 20261017190000_sign_written_docs inside a transaction that is rolled back.
-- Uses live rows read-only except inside this transaction. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert, select on t_results to authenticated;

-- Setup: a yes/no field on the form, job_title optional and empty on the offer.
do $$
declare
  v_form uuid := '5cd4d4c1-a520-4936-9489-11d7758fab91';
begin
  insert into public.offer_form_fields (form_id, field_name, field_label, field_type, display_order, is_required, organization_id, created_by)
  select v_form, 'relocation_bonus', 'Relocation bonus', 'checkbox', 99, true, ff.organization_id, ff.created_by
  from public.offer_form_fields ff where ff.form_id = v_form order by ff.display_order limit 1;
end $$;

create temp table t_ids (k text primary key, v uuid);
grant select on t_ids to authenticated;
insert into t_ids values ('tpl', gen_random_uuid()), ('role', gen_random_uuid()), ('written', gen_random_uuid()), ('doc', gen_random_uuid());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);
do $$
declare
  v_ten uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  v_form uuid := '5cd4d4c1-a520-4936-9489-11d7758fab91';
  v_free uuid := 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e';
  v_tpl uuid := (select v from t_ids where k = 'tpl');
  v_role uuid := (select v from t_ids where k = 'role');
  v_wid uuid := (select v from t_ids where k = 'written');
  v_src uuid;
  d record;
  v_content jsonb;
  v_t jsonb;
  v_bad jsonb;
  v_p jsonb;
begin
  select id into v_src from public.sign_templates where app = 'ats' and kind = 'candidate' and archived_at is null order by created_at limit 1;
  select * into d from public.sign_documents where template_id = v_src and removed_at is null order by position limit 1;

  -- A written offer letter: a heading, the job, a section only when there's a
  -- relocation bonus (showing the base salary), and the candidate's signature.
  v_content := jsonb_build_object('root', jsonb_build_object('type', 'root', 'children', jsonb_build_array(
    jsonb_build_object('type', 'heading', 'tag', 'h1', 'children', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Offer of employment'))),
    jsonb_build_object('type', 'paragraph', 'children', jsonb_build_array(
      jsonb_build_object('type', 'text', 'text', 'Dear '), jsonb_build_object('type', 'placeholder', 'placeholderKey', 'name'),
      jsonb_build_object('type', 'text', 'text', ', we offer you the role of '), jsonb_build_object('type', 'placeholder', 'placeholderKey', 'job_title'))),
    jsonb_build_object('type', 'gio-if', 'key', 'relocation_bonus', 'op', 'yes', 'children', jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'children', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', 'Relocation is paid on top of '), jsonb_build_object('type', 'placeholder', 'placeholderKey', 'base_salary'))))),
    jsonb_build_object('type', 'gio-sign', 'roleId', v_role, 'kind', 'signature')
  )));

  v_t := jsonb_build_object(
    'id', v_tpl, 'tenant_id', v_ten, 'name', 'Test written offer', 'kind', 'candidate', 'app', 'ats',
    'offer_form_id', v_form, 'subject', 's', 'body', 'b',
    'docs', jsonb_build_array(jsonb_build_object('id', (select v from t_ids where k = 'doc'), 'name', d.name, 'storage_path', d.storage_path, 'page_count', d.page_count, 'page_sizes', d.page_sizes, 'size_bytes', d.size_bytes, 'sha256', d.sha256, 'position', 1)),
    'written', jsonb_build_array(jsonb_build_object('id', v_wid, 'name', 'Offer letter', 'position', 0, 'content', v_content)),
    'roles', jsonb_build_array(jsonb_build_object('id', v_role, 'label', 'Candidate', 'role', 'signer', 'fixed', false, 'color', '#D7C5FB')),
    'fields', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'type', 'initials', 'rid', v_role, 'page', 0, 'x', 80, 'y', 90, 'w', 10, 'h', 5)));

  -- Refusals.
  begin
    perform public.sign_save_template(jsonb_set(v_t, '{written,0,content,root,children,1,children,1,placeholderKey}', '"not_on_the_form"'));
    insert into t_results select 'save: unknown tag in the text refused', false;
  exception when others then
    insert into t_results select 'save: unknown tag in the text refused', sqlstate = 'GSN12' and sqlerrm like '%not_on_the_form%';
  end;
  begin
    perform public.sign_save_template(jsonb_set(v_t, '{written,0,content,root,children,3,roleId}', to_jsonb(gen_random_uuid())));
    insert into t_results select 'save: block for an unknown role refused', false;
  exception when others then
    insert into t_results select 'save: block for an unknown role refused', sqlstate = 'GSN12';
  end;
  begin
    perform public.sign_save_template(jsonb_set(v_t, '{written,0,content,root,children,3,kind}', '"initials"'));
    insert into t_results select 'save: a signer needs a signature somewhere', false;
  exception when others then
    insert into t_results select 'save: a signer needs a signature somewhere', sqlerrm like '%still needs a signature%';
  end;
  begin
    perform public.sign_save_template(jsonb_set(v_t, '{written,0,position}', '1'));
    insert into t_results select 'save: two documents in one place refused', false;
  exception when others then
    insert into t_results select 'save: two documents in one place refused', sqlerrm like '%order is mixed up%';
  end;

  -- The real save: the signing block is the signer's signature.
  perform public.sign_save_template(v_t);
  insert into t_results select 'save: written document stored',
    exists (select 1 from public.sign_written_docs where id = v_wid and template_id = v_tpl and position = 0 and removed_at is null);
  insert into t_results select 'save: uploaded document keeps its place',
    exists (select 1 from public.sign_documents where template_id = v_tpl and position = 1 and removed_at is null);

  -- Saving again without the written document soft-removes it.
  perform public.sign_save_template(jsonb_set(jsonb_set(v_t, '{written}', '[]'), '{fields}',
    (v_t->'fields') || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'type', 'signature', 'rid', v_role, 'page', 0, 'x', 10, 'y', 80, 'w', 30, 'h', 6))));
  insert into t_results select 'save: removed written document is soft-removed',
    exists (select 1 from public.sign_written_docs where id = v_wid and removed_at is not null);
  perform public.sign_save_template(v_t);
  insert into t_results select 'save: and comes back when saved again',
    exists (select 1 from public.sign_written_docs where id = v_wid and removed_at is null);
end $$;

-- Which values it fills in (sign_template_keys is internal, so as the owner).
reset role;
insert into t_results select 'keys: tag outside a section is needed',
  exists (select 1 from public.sign_template_keys((select v from t_ids where k = 'tpl')) k where k.key = 'job_title' and k.needed);
insert into t_results select 'keys: tag inside a section is not needed',
  exists (select 1 from public.sign_template_keys((select v from t_ids where k = 'tpl')) k where k.key = 'base_salary' and not k.needed);
insert into t_results select 'keys: the condition''s own value is not needed',
  exists (select 1 from public.sign_template_keys((select v from t_ids where k = 'tpl')) k where k.key = 'relocation_bonus' and not k.needed);
insert into t_results select 'keys: signed-in users can''t call it',
  not has_function_privilege('authenticated', 'public.sign_template_keys(uuid)', 'execute');

-- An empty base salary (only used inside the section) doesn't block; an empty
-- job title (outside it, required on the form) does.
reset role;
update public.offer_letters set field_values = field_values || '{"relocation_bonus":"true","job_title":"","base_salary":""}'
 where id = 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);
do $$
declare
  v_tpl uuid := (select v from t_ids where k = 'tpl');
  v_role uuid := (select v from t_ids where k = 'role');
  v_free uuid := 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e';
  v_p jsonb;
begin
  v_p := public.sign_send_preview(v_tpl, 'ats_offer', v_free, null);
  insert into t_results select 'preview: written values listed',
    exists (select 1 from jsonb_array_elements(v_p->'used') u where u->>'key' = 'job_title')
    and exists (select 1 from jsonb_array_elements(v_p->'used') u where u->>'key' = 'base_salary' and (u->>'optional')::boolean);
  insert into t_results select 'preview: written required value missing', (v_p->'missing') @> '["Job Title"]'::jsonb;
  begin
    perform public.sign_send(v_tpl, 'ats_offer', v_free, null, jsonb_build_array(jsonb_build_object('role_id', v_role, 'name', 'Test Person', 'email', 'test1@example.com')));
    insert into t_results select 'send: written required value blocks', false;
  exception when others then
    insert into t_results select 'send: written required value blocks', sqlstate = 'GSN14' and sqlerrm like '%Job Title%' and sqlerrm not like '%Base Salary%';
  end;
end $$;

reset role;
update public.offer_letters set field_values = field_values || '{"job_title":"Talent Acquisition Partner"}'
 where id = 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e';
create temp table t_env (v uuid);
grant insert, select on t_env to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);
do $$
declare
  v_tpl uuid := (select v from t_ids where k = 'tpl');
  v_role uuid := (select v from t_ids where k = 'role');
  v_env uuid;
begin
  v_env := public.sign_send(v_tpl, 'ats_offer', 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e', null,
    jsonb_build_array(jsonb_build_object('role_id', v_role, 'name', 'Test Person', 'email', 'test1@example.com')));
  insert into t_env values (v_env);
  insert into t_results select 'send: goes out with the conditional value empty', v_env is not null;
  insert into t_results select 'send: written document copied to the envelope',
    exists (select 1 from public.sign_written_docs where envelope_id = v_env and position = 0 and rendered_document_id is null);
  insert into t_results select 'send: uploaded field keeps its page for now',
    exists (select 1 from public.sign_fields where envelope_id = v_env and type = 'initials' and page = 0);
  -- A client can't mark it rendered.
  update public.sign_written_docs set render_error = 'x', render_attempts = 9 where envelope_id = v_env;
  insert into t_results select 'guard: clients can''t touch the render state',
    exists (select 1 from public.sign_written_docs where envelope_id = v_env and render_error is null and render_attempts = 0);
  insert into t_results select 'guard: attach is not for clients',
    not has_function_privilege('authenticated', 'public.sign_attach_render(uuid, text, int, jsonb, int, text, jsonb)', 'execute');
end $$;

-- The minute job: waits for the PDF, then attaches it and sends.
reset role;
do $$
declare
  v_env uuid := (select v from t_env);
  v_role uuid := (select v from t_ids where k = 'role');
  w record;
  v_doc uuid;
  v_claimed int;
begin
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes set dispatch_at = now() - interval '1 minute' where id = v_env;
  perform set_config('gio.sign_rpc', '', true);
  select count(*) into v_claimed from public.sign_claim_due(200) c where c.envelope_id = v_env;
  insert into t_results select 'claim: waits until the written document has its PDF', v_claimed = 0;

  select * into w from public.sign_written_docs where envelope_id = v_env;
  begin
    perform public.sign_attach_render(w.id, 'elsewhere/x.pdf', 2, '[{"w":612,"h":792},{"w":612,"h":792}]', 1000, null, '[]');
    insert into t_results select 'attach: a path outside the envelope refused', false;
  exception when others then
    insert into t_results select 'attach: a path outside the envelope refused', sqlstate = 'GSN12';
  end;
  v_doc := public.sign_attach_render(w.id, w.tenant_id || '/envelopes/' || v_env || '/written-' || w.id || '.pdf', 2,
    '[{"w":612,"h":792},{"w":612,"h":792}]', 1000, null,
    jsonb_build_array(jsonb_build_object('role_id', v_role, 'kind', 'signature', 'page', 1, 'x', 10, 'y', 20, 'w', 30, 'h', 6)));
  insert into t_results select 'attach: the PDF takes the written document''s place',
    exists (select 1 from public.sign_documents where id = v_doc and envelope_id = v_env and position = 0 and page_count = 2);
  insert into t_results select 'attach: later pages move down',
    exists (select 1 from public.sign_fields where envelope_id = v_env and type = 'initials' and page = 2);
  insert into t_results select 'attach: the block becomes the signer''s field',
    exists (select 1 from public.sign_fields f join public.sign_recipients r on r.id = f.recipient_id
            where f.envelope_id = v_env and f.type = 'signature' and f.page = 1 and r.template_role_id = v_role);
  insert into t_results select 'attach: twice is harmless',
    public.sign_attach_render(w.id, 'x', 1, '[]', 1, null, '[]') = v_doc;
  select count(*) into v_claimed from public.sign_claim_due(200) c where c.envelope_id = v_env;
  insert into t_results select 'claim: sends once the PDF is there', v_claimed = 1;
end $$;

-- A changed written value marks the envelope out of date.
update public.offer_letters set field_values = field_values || '{"job_title":"Senior Talent Partner"}'
 where id = 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e';
insert into t_results select 'out of date: a written value changed',
  (select out_of_date from public.sign_envelopes where id = (select v from t_env));

select check_name as check, ok from t_results;
