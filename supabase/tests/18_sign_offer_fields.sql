-- Run after 20261017171933_sign_offer_fields inside a transaction that is rolled back.
-- Uses live rows read-only except inside this transaction. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert, select on t_results to authenticated;

-- 1. Words for every field type.
insert into t_results values
  ('display: number', public.sign_offer_display('number', '1250', null, null) = '1,250'),
  ('display: number left as typed', public.sign_offer_display('number', 'about ten', null, null) = 'about ten'),
  ('display: url', public.sign_offer_display('url', 'https://www.acme.com/careers/', null, null) = 'acme.com/careers'),
  ('display: linkedin', public.sign_offer_display('linkedin', 'https://linkedin.com/in/priya', null, null) = 'linkedin.com/in/priya'),
  ('display: phone', public.sign_offer_display('phone', '+52   33 1991  0667', null, null) = '+52 33 1991 0667'),
  ('display: score', public.sign_offer_display('score', '4', '{}', null) = '4 out of 5'),
  ('display: score with max', public.sign_offer_display('score', '7', '{"max":10}', null) = '7 out of 10'),
  ('display: file name, not path', public.sign_offer_display('file', 'tenant/offers/1760000000000-Signed contract.pdf', null, null) = 'Signed contract.pdf'),
  ('display: checkbox', public.sign_offer_display('checkbox', 'true', null, null) = 'Yes'),
  ('display: salary unchanged', public.sign_offer_display('salary', '{"amount":"132500","currency":"MXN"}', null, null) = 'MXN 132,500');

-- Setup inside the transaction: job_title optional and empty, a yes/no field.
do $$
declare
  v_form uuid := '5cd4d4c1-a520-4936-9489-11d7758fab91';
  v_free uuid := 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e';
begin
  update public.offer_form_fields set is_required = false where form_id = v_form and field_name = 'job_title';
  insert into public.offer_form_fields (form_id, field_name, field_label, field_type, display_order, is_required, organization_id, created_by)
  select v_form, 'relocation_bonus', 'Relocation bonus', 'checkbox', 99, true, ff.organization_id, ff.created_by
  from public.offer_form_fields ff where ff.form_id = v_form order by ff.display_order limit 1;
  update public.offer_letters
     set field_values = field_values || '{"job_title":"","relocation_bonus":"true","phone_number":""}'
   where id = v_free;
end $$;

-- 2 and 3, as Allan in the app.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);
do $$
declare
  v_ten uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  v_form uuid := '5cd4d4c1-a520-4936-9489-11d7758fab91';
  v_free uuid := 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e';
  v_src uuid;
  v_doc record;
  v_t jsonb;
  v_id uuid := gen_random_uuid();
  v_role uuid := '11111111-1111-4111-8111-111111111111';
  v_p jsonb;
begin
  select id into v_src from public.sign_templates where app = 'ats' and kind = 'candidate' and archived_at is null order by created_at limit 1;
  select * into v_doc from public.sign_documents where template_id = v_src and removed_at is null order by position limit 1;
  v_t := jsonb_build_object(
    'id', v_id, 'tenant_id', v_ten, 'name', 'Test offer fields', 'kind', 'candidate', 'app', 'ats',
    'offer_form_id', v_form, 'subject', 's', 'body', 'b',
    'docs', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'name', v_doc.name, 'storage_path', v_doc.storage_path, 'page_count', v_doc.page_count, 'page_sizes', v_doc.page_sizes, 'size_bytes', v_doc.size_bytes, 'sha256', v_doc.sha256)),
    'roles', jsonb_build_array(jsonb_build_object('id', v_role, 'label', 'Candidate', 'role', 'signer', 'fixed', false, 'color', '#D7C5FB')),
    'fields', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'type', 'signature', 'rid', v_role, 'page', 0, 'x', 10, 'y', 80, 'w', 30, 'h', 6),
      jsonb_build_object('id', gen_random_uuid(), 'type', 'data', 'data_key', 'job_title', 'page', 0, 'x', 10, 'y', 20, 'w', 30, 'h', 3),
      jsonb_build_object('id', gen_random_uuid(), 'type', 'data', 'data_key', 'base_salary', 'page', 0, 'x', 10, 'y', 25, 'w', 30, 'h', 3, 'data_style', 'tick'),
      jsonb_build_object('id', gen_random_uuid(), 'type', 'data', 'data_key', 'relocation_bonus', 'page', 0, 'x', 10, 'y', 30, 'w', 3, 'h', 3, 'data_style', 'tick'),
      jsonb_build_object('id', gen_random_uuid(), 'type', 'data', 'data_key', 'phone_number', 'page', 0, 'x', 10, 'y', 35, 'w', 30, 'h', 3)));

  -- The tick is for yes/no fields only.
  begin
    perform public.sign_save_template(v_t);
    insert into t_results select 'save: tick on a non yes/no field refused', false;
  exception when others then
    insert into t_results select 'save: tick on a non yes/no field refused', sqlstate = 'GSN12' and sqlerrm like '%base_salary%';
  end;
  v_t := jsonb_set(v_t, '{fields,2}', (v_t->'fields'->2) - 'data_style');
  perform public.sign_save_template(v_t);
  insert into t_results select 'save: tick stored on the yes/no field',
    exists (select 1 from public.sign_fields where template_id = v_id and data_key = 'relocation_bonus' and data_style = 'tick')
    and not exists (select 1 from public.sign_fields where template_id = v_id and data_key <> 'relocation_bonus' and data_style is not null);

  -- Preview: the empty optional field is blank, the empty required one is missing.
  v_p := public.sign_send_preview(v_id, 'ats_offer', v_free, null);
  insert into t_results select 'preview: optional empty is blank, not missing',
    (v_p->'blank') @> '["Job Title"]'::jsonb and not ((v_p->'missing') @> '["Job Title"]'::jsonb);
  insert into t_results select 'preview: required empty is missing', (v_p->'missing') @> '["Phone Number"]'::jsonb;
  insert into t_results select 'preview: used marks optional',
    exists (select 1 from jsonb_array_elements(v_p->'used') u where u->>'key' = 'job_title' and (u->>'optional')::boolean)
    and exists (select 1 from jsonb_array_elements(v_p->'used') u where u->>'key' = 'phone_number' and not (u->>'optional')::boolean);

  -- Send: refused for the required one only.
  begin
    perform public.sign_send(v_id, 'ats_offer', v_free, null, jsonb_build_array(jsonb_build_object('role_id', v_role, 'name', 'Test Person', 'email', 'test1@example.com')));
    insert into t_results select 'send: empty required field blocks', false;
  exception when others then
    insert into t_results select 'send: empty required field blocks', sqlstate = 'GSN14' and sqlerrm like '%Phone Number%' and sqlerrm not like '%Job Title%';
  end;
end $$;

reset role;
update public.offer_letters set field_values = field_values || '{"phone_number":"+52 3319910667"}' where id = 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);
do $$
declare
  v_free uuid := 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e';
  v_id uuid;
  v_env uuid;
begin
  select id into v_id from public.sign_templates where name = 'Test offer fields' and archived_at is null order by created_at desc limit 1;
  v_env := public.sign_send(v_id, 'ats_offer', v_free, null,
    jsonb_build_array(jsonb_build_object('role_id', '11111111-1111-4111-8111-111111111111', 'name', 'Test Person', 'email', 'test1@example.com')));
  insert into t_results select 'send: goes out with the optional field empty', v_env is not null;
  insert into t_results select 'send: optional field frozen as empty',
    exists (select 1 from public.sign_fields where envelope_id = v_env and data_key = 'job_title' and value is null);
  insert into t_results select 'send: tick style and Yes travel to the envelope',
    exists (select 1 from public.sign_fields where envelope_id = v_env and data_key = 'relocation_bonus' and data_style = 'tick' and value = 'Yes');
  insert into t_results select 'send: phone printed tidied',
    exists (select 1 from public.sign_fields where envelope_id = v_env and data_key = 'phone_number' and value = '+52 3319910667');
end $$;
reset role;

-- The column rule: a tick only on data fields.
do $$
begin
  begin
    insert into public.sign_fields (tenant_id, template_id, type, page, x, y, w, h, recipient_id, data_style)
    select tenant_id, template_id, 'text', 0, 1, 1, 1, 1, recipient_id, 'tick'
    from public.sign_fields where template_id is not null and type = 'signature' and removed_at is null limit 1;
    insert into t_results select 'column: tick refused on a non-data field', false;
  exception when check_violation then
    insert into t_results select 'column: tick refused on a non-data field', true;
  end;
end $$;

select check_name as check, ok from t_results;
