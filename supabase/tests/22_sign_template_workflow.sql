-- Run after 20261017210000_sign_template_workflow inside a transaction that is rolled back.
-- Fake templates on real records; Allan is the sender. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert, select on t_results to authenticated;
create temp table t_ids (k text primary key, v uuid);
grant select on t_ids to authenticated;
insert into t_ids values ('tpl', gen_random_uuid()), ('cand', gen_random_uuid()), ('copy', gen_random_uuid()),
  ('wdoc', gen_random_uuid()), ('bad', gen_random_uuid());
create temp table t_env (v uuid);
grant insert, select on t_env to authenticated;

-- ---- Formats (pure) ----------------------------------------------------------------
insert into t_results select 'format: money as code with its period',
  public.sign_format('salary', '{"amount":"480000","currency":"MXN"}', '{"period":"annually"}', 'money_code') = 'MXN 480,000 / yearly';
insert into t_results select 'format: money with symbol',
  public.sign_format('salary', '{"amount":"480000","currency":"MXN"}', '{"period":"annually"}', 'money_symbol') = '$480,000 MXN per year';
insert into t_results select 'format: money in words with the figure',
  public.sign_format('salary', '{"amount":"480000","currency":"MXN"}', '{"period":"monthly"}', 'money_words')
    = 'four hundred eighty thousand Mexican pesos (MXN 480,000) per month';
insert into t_results select 'format: dates three ways',
  public.sign_format('date', '2026-10-26', null, 'date_long') = 'October 26, 2026'
  and public.sign_format('date', '2026-10-26', null, 'date_numeric') = '26/10/2026'
  and public.sign_format('date', '2026-10-26', null, 'date_dmy') = '26 October 2026';
insert into t_results select 'format: numbers in words with the figure',
  public.sign_format('number', '12', null, 'number_words') = 'twelve (12)'
  and public.sign_num_words(1234567) = 'one million two hundred thirty-four thousand five hundred sixty-seven';
insert into t_results select 'format: a format that doesn''t fit gives nothing',
  public.sign_format('text', 'Remote', null, 'date_numeric') is null;

-- ---- Saving -------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);
do $$
declare
  v_ten uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  v_form uuid := '5cd4d4c1-a520-4936-9489-11d7758fab91';
  v_tpl uuid := (select v from t_ids where k = 'tpl');
  v_cand uuid := (select v from t_ids where k = 'cand');
  v_copy uuid := (select v from t_ids where k = 'copy');
  v_src uuid;
  d record;
  v_t jsonb;
  v_text jsonb;
  v_sign jsonb;
begin
  select id into v_src from public.sign_templates where app = 'ats' and kind = 'candidate' and archived_at is null order by created_at limit 1;
  select * into d from public.sign_documents where template_id = v_src and removed_at is null order by position limit 1;
  v_sign := jsonb_build_object('type', 'gio-sign', 'roleId', v_cand, 'kind', 'signature', 'version', 1);
  v_text := jsonb_build_object('root', jsonb_build_object('type', 'root', 'children', jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'children', jsonb_build_array(
      jsonb_build_object('type', 'text', 'text', 'Signed on '),
      jsonb_build_object('type', 'placeholder', 'placeholderKey', 'today', 'format', 'date_numeric'),
      jsonb_build_object('type', 'gio-field', 'roleId', v_cand, 'fieldType', 'text', 'required', false, 'label', 'Bank account'))),
    v_sign)));
  v_t := jsonb_build_object(
    'id', v_tpl, 'tenant_id', v_ten, 'name', 'Test workflow', 'kind', 'candidate', 'app', 'ats',
    'offer_form_id', v_form, 'subject', 's', 'body', 'b',
    'docs', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'name', d.name, 'storage_path', d.storage_path, 'page_count', d.page_count, 'page_sizes', d.page_sizes, 'size_bytes', d.size_bytes, 'sha256', d.sha256, 'position', 1)),
    'written', jsonb_build_array(jsonb_build_object('id', (select v from t_ids where k = 'wdoc'), 'name', 'Offer letter', 'position', 0, 'content', v_text)),
    'roles', jsonb_build_array(
      jsonb_build_object('id', v_cand, 'label', 'Candidate', 'role', 'signer', 'fixed', false, 'color', '#D7C5FB', 'fill_from', 'record'),
      jsonb_build_object('id', v_copy, 'label', 'HR copy', 'role', 'cc', 'fixed', false, 'color', '#BCD7F5', 'fill_from', 'sender')),
    'fields', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'type', 'data', 'page', 0, 'x', 10, 'y', 20, 'w', 30, 'h', 3, 'data_key', 'today', 'data_format', 'date_dmy')));

  -- An unknown format is refused, placed or written.
  begin
    perform public.sign_save_template(jsonb_set(v_t, '{fields,0,data_format}', '"date_weird"'));
    insert into t_results select 'save: unknown format on a placed value refused', false;
  exception when others then
    insert into t_results select 'save: unknown format on a placed value refused', sqlstate = 'GSN12' and sqlerrm like '%date_weird%';
  end;
  begin
    perform public.sign_save_template(jsonb_set(v_t, '{written,0,content,root,children,0,children,1,format}', '"loud"'));
    insert into t_results select 'save: unknown format in the text refused', false;
  exception when others then
    insert into t_results select 'save: unknown format in the text refused', sqlstate = 'GSN12' and sqlerrm like '%loud%';
  end;
  -- A signer field in the text must belong to a role that signs, and be a kind a signer fills.
  begin
    perform public.sign_save_template(jsonb_set(v_t, '{written,0,content,root,children,0,children,2,roleId}', to_jsonb(v_copy)));
    insert into t_results select 'save: signer field for a copy-only role refused', false;
  exception when others then
    insert into t_results select 'save: signer field for a copy-only role refused', sqlstate = 'GSN12';
  end;
  begin
    perform public.sign_save_template(jsonb_set(v_t, '{written,0,content,root,children,0,children,2,fieldType}', '"signature"'));
    insert into t_results select 'save: signer field of an unknown kind refused', false;
  exception when others then
    insert into t_results select 'save: signer field of an unknown kind refused', sqlstate = 'GSN12';
  end;
  -- A signing block only inside a conditional section isn't a signature.
  begin
    perform public.sign_save_template(jsonb_set(jsonb_set(v_t, '{id}', to_jsonb((select v from t_ids where k = 'bad'))),
      '{written,0,content,root,children,1}',
      jsonb_build_object('type', 'gio-if', 'key', 'today', 'op', 'filled', 'children', jsonb_build_array(v_sign))));
    insert into t_results select 'save: signing block inside a section doesn''t count', false;
  exception when others then
    insert into t_results select 'save: signing block inside a section doesn''t count', sqlstate = 'GSN12' and sqlerrm like '%needs a signature%';
  end;

  perform public.sign_save_template(v_t);
  insert into t_results select 'save: format stored on the placed value',
    exists (select 1 from public.sign_fields where template_id = v_tpl and data_key = 'today' and data_format = 'date_dmy');
end $$;

-- ---- Previewing and sending ----------------------------------------------------------
do $$
declare
  v_tpl uuid := (select v from t_ids where k = 'tpl');
  v_p jsonb;
  v_env uuid;
  v_today date := (now() at time zone 'America/Mexico_City')::date;
begin
  v_p := public.sign_send_preview(v_tpl, 'ats_offer', 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e', null);
  insert into t_results select 'preview: formatted values as key|format',
    v_p->'values'->>'today|date_numeric' = to_char(v_today, 'DD/MM/YYYY')
    and v_p->'values'->>'today|date_dmy' = to_char(v_today, 'FMDD FMMonth YYYY')
    and v_p->'values'->>'today' = to_char(v_today, 'FMMonth FMDD, YYYY');

  v_env := public.sign_send(v_tpl, 'ats_offer', 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e', null, '[]'::jsonb);
  insert into t_env values (v_env);
  insert into t_results select 'send: placed value frozen in its format',
    exists (select 1 from public.sign_fields where envelope_id = v_env and data_key = 'today'
            and data_format = 'date_dmy' and value = to_char(v_today, 'FMDD FMMonth YYYY'));
  insert into t_results select 'send: text formats saved with the envelope',
    (select data_snapshot->>'today|date_numeric' = to_char(v_today, 'DD/MM/YYYY') from public.sign_envelopes where id = v_env);
end $$;

-- ---- Rendering: signer fields from the text become fields ---------------------------
reset role;
insert into t_results select 'save: uses lists both formats',
  public.sign_template_uses((select v from t_ids where k = 'tpl')) @> '[["today","date_dmy"],["today","date_numeric"]]'::jsonb;
do $$
declare
  v_env uuid := (select v from t_env);
  w uuid;
  v_ten uuid;
begin
  select x.id, x.tenant_id into w, v_ten from public.sign_written_docs x where x.envelope_id = v_env and x.removed_at is null;
  perform public.sign_attach_render(w, v_ten::text || '/envelopes/' || v_env::text || '/written-test.pdf', 1, '[{"w":612,"h":792}]'::jsonb, 1000, null,
    jsonb_build_array(
      jsonb_build_object('role_id', (select v from t_ids where k = 'cand'), 'kind', 'signature', 'page', 0, 'x', 10, 'y', 60, 'w', 35, 'h', 5),
      jsonb_build_object('role_id', (select v from t_ids where k = 'cand'), 'kind', 'text', 'required', false, 'label', 'Bank account', 'page', 0, 'x', 10, 'y', 40, 'w', 30, 'h', 3)));
  insert into t_results select 'render: signer field keeps its kind, required flag and label',
    exists (select 1 from public.sign_fields where envelope_id = v_env and type = 'text' and not required and label = 'Bank account' and page = 0);
  insert into t_results select 'render: signature block still required',
    exists (select 1 from public.sign_fields where envelope_id = v_env and type = 'signature' and required and page = 0);
  begin
    perform public.sign_attach_render(w, 'x', 1, '[{"w":612,"h":792}]'::jsonb, 1000, null, '[]'::jsonb);
    insert into t_results select 'render: a second render is a no-op', true;
  exception when others then
    insert into t_results select 'render: a second render is a no-op', false;
  end;
end $$;

-- ---- The editor's sample ---------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);
insert into t_results select 'sample: latest offer on the form, with formats',
  (select s->>'offer_id' is not null and s->>'first_name' is not null and s->'values' ? 'today|date_numeric'
   from (select public.sign_sample_values('5cd4d4c1-a520-4936-9489-11d7758fab91', '[["today","date_numeric"]]'::jsonb) as s) x);
reset role;

insert into t_results select 'privileges: helpers not callable by signed-in users',
  not has_function_privilege('authenticated', 'public.sign_value_variant(jsonb, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.sign_variants(jsonb, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.sign_attach_render(uuid, text, integer, jsonb, integer, text, jsonb)', 'execute');
insert into t_results select 'privileges: the sample is for signed-in users only',
  has_function_privilege('authenticated', 'public.sign_sample_values(uuid, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.sign_sample_values(uuid, jsonb)', 'execute');

select check_name as check, ok from t_results;
