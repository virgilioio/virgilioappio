-- Run after 20261017230000_sign_client_company inside a transaction that is rolled back.
-- Real records, fake templates; Allan is the sender. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert, select on t_results to authenticated;
create temp table t_ids (k text primary key, v uuid);
grant select on t_ids to authenticated;
insert into t_ids values ('tpl', gen_random_uuid()), ('cand', gen_random_uuid()), ('member', gen_random_uuid()), ('mrole', gen_random_uuid());
create temp table t_expect (offer_id uuid, candidate_id uuid, job_id uuid, client text);
grant select on t_expect to authenticated;
insert into t_expect
select ol.id, ol.candidate_id, ol.job_id, nullif(btrim(o.name), '')
from public.offer_letters ol
join public.jobs j on j.id = ol.job_id
join public.organizations o on o.id = j.organization_id
where ol.id = 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e';

-- ---- The value -------------------------------------------------------------------
insert into t_results select 'values: an offer carries its job''s client',
  (select client is not null from t_expect)
  and (select public.sign_record_values('ats_offer', offer_id, null)->'values'->>'client' = client from t_expect);
insert into t_results select 'values: a candidate and job carry the client too',
  (select public.sign_record_values('candidate', candidate_id, job_id)->'values'->>'client' = client from t_expect);
insert into t_results select 'values: the offer''s own fields still come through',
  (select public.sign_record_values('ats_offer', offer_id, null)->'values' ? 'name' from t_expect);

-- ---- Saving -------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);
do $$
declare
  v_ten uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  v_tpl uuid := (select v from t_ids where k = 'tpl');
  v_cand uuid := (select v from t_ids where k = 'cand');
  v_text jsonb;
  v_t jsonb;
begin
  v_text := jsonb_build_object('root', jsonb_build_object('type', 'root', 'children', jsonb_build_array(
    jsonb_build_object('type', 'paragraph', 'children', jsonb_build_array(
      jsonb_build_object('type', 'text', 'text', 'Your offer from '),
      jsonb_build_object('type', 'placeholder', 'placeholderKey', 'client'))),
    jsonb_build_object('type', 'gio-sign', 'roleId', v_cand, 'kind', 'signature', 'version', 1))));
  v_t := jsonb_build_object(
    'id', v_tpl, 'tenant_id', v_ten, 'name', 'Test client company', 'kind', 'candidate', 'app', 'ats',
    'subject', 'Your offer from {{client}}', 'body', 'b', 'docs', '[]'::jsonb, 'fields', '[]'::jsonb,
    'written', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'name', 'Offer letter', 'position', 0, 'content', v_text)),
    'roles', jsonb_build_array(jsonb_build_object('id', v_cand, 'label', 'Candidate', 'role', 'signer', 'fixed', false, 'color', '#D7C5FB', 'fill_from', 'record')));
  perform public.sign_save_template(v_t);
  insert into t_results select 'save: a candidate template can print the client',
    exists (select 1 from public.sign_templates where id = v_tpl and subject = 'Your offer from {{client}}');

  -- Member templates have no job, so no client.
  begin
    perform public.sign_save_template(v_t
      || jsonb_build_object('id', (select v from t_ids where k = 'member'), 'kind', 'member',
           'roles', jsonb_build_array(jsonb_build_object('id', v_cand, 'label', 'Member', 'role', 'signer', 'fixed', false, 'color', '#D7C5FB', 'fill_from', 'record'))));
    insert into t_results select 'save: a member template can''t use the client', false;
  exception when others then
    insert into t_results select 'save: a member template can''t use the client', sqlstate = 'GSN12' and sqlerrm like '%client%';
  end;
end $$;

-- ---- Previewing and the editor's sample ----------------------------------------------
insert into t_results select 'preview: the send preview fills the client',
  (select public.sign_send_preview((select v from t_ids where k = 'tpl'), 'ats_offer', offer_id, null)->'values'->>'client' = client from t_expect);
insert into t_results select 'sample: the editor''s sample has a client',
  (select public.sign_sample_values(null, '[]'::jsonb)->'values' ? 'client');
reset role;

insert into t_results select 'privileges: record values still not callable by signed-in users',
  not has_function_privilege('authenticated', 'public.sign_record_values(sign_source, uuid, uuid)', 'execute');

select check_name as check, ok from t_results;
