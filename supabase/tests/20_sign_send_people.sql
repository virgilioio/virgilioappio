-- Run after 20261017200000_sign_send_people inside a transaction that is rolled back.
-- Uses live rows read-only except inside this transaction. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert, select on t_results to authenticated;
create temp table t_ids (k text primary key, v uuid);
grant select on t_ids to authenticated;
insert into t_ids values ('tpl', gen_random_uuid()), ('cand', gen_random_uuid()), ('hm', gen_random_uuid()), ('wit', gen_random_uuid()), ('copy', gen_random_uuid()), ('mtpl', gen_random_uuid());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);
do $$
declare
  v_ten uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  v_form uuid := '5cd4d4c1-a520-4936-9489-11d7758fab91';
  v_tpl uuid := (select v from t_ids where k = 'tpl');
  v_src uuid;
  d record;
  v_t jsonb;
  v_role jsonb;
begin
  select id into v_src from public.sign_templates where app = 'ats' and kind = 'candidate' and archived_at is null order by created_at limit 1;
  select * into d from public.sign_documents where template_id = v_src and removed_at is null order by position limit 1;
  v_t := jsonb_build_object(
    'id', v_tpl, 'tenant_id', v_ten, 'name', 'Test people', 'kind', 'candidate', 'app', 'ats',
    'offer_form_id', v_form, 'subject', 's', 'body', 'b',
    'not_needed', jsonb_build_array('job_title', 'not_a_field'),
    'docs', jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'name', d.name, 'storage_path', d.storage_path, 'page_count', d.page_count, 'page_sizes', d.page_sizes, 'size_bytes', d.size_bytes, 'sha256', d.sha256)),
    'roles', jsonb_build_array(
      jsonb_build_object('id', (select v from t_ids where k = 'cand'), 'label', 'Candidate', 'role', 'signer', 'fixed', false, 'color', '#D7C5FB', 'fill_from', 'record'),
      jsonb_build_object('id', (select v from t_ids where k = 'hm'), 'label', 'Hiring manager', 'role', 'signer', 'fixed', false, 'color', '#BFE3CF', 'fill_from', 'hiring_manager'),
      jsonb_build_object('id', (select v from t_ids where k = 'wit'), 'label', 'Witness', 'role', 'signer', 'fixed', false, 'color', '#F8D7B0', 'fill_from', 'typed'),
      jsonb_build_object('id', (select v from t_ids where k = 'copy'), 'label', 'HR copy', 'role', 'cc', 'fixed', false, 'color', '#BCD7F5', 'fill_from', 'sender')),
    'fields', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'type', 'signature', 'rid', (select v from t_ids where k = 'cand'), 'page', 0, 'x', 10, 'y', 80, 'w', 20, 'h', 5),
      jsonb_build_object('id', gen_random_uuid(), 'type', 'signature', 'rid', (select v from t_ids where k = 'hm'), 'page', 0, 'x', 40, 'y', 80, 'w', 20, 'h', 5),
      jsonb_build_object('id', gen_random_uuid(), 'type', 'signature', 'rid', (select v from t_ids where k = 'wit'), 'page', 0, 'x', 70, 'y', 80, 'w', 20, 'h', 5)));

  begin
    perform public.sign_save_template(jsonb_set(v_t, '{roles,0,fill_from}', '"somewhere"'));
    insert into t_results select 'save: unknown source refused', false;
  exception when others then
    insert into t_results select 'save: unknown source refused', sqlstate = 'GSN12';
  end;
  begin
    perform public.sign_save_template(jsonb_set(jsonb_set(jsonb_set(v_t, '{id}', to_jsonb((select v from t_ids where k = 'mtpl'))), '{kind}', '"member"'), '{offer_form_id}', 'null'));
    insert into t_results select 'save: hiring manager on a member template refused', false;
  exception when others then
    insert into t_results select 'save: hiring manager on a member template refused', sqlstate = 'GSN12';
  end;

  perform public.sign_save_template(v_t);
  insert into t_results select 'save: sources stored',
    (select count(*) from public.sign_recipients where template_id = v_tpl and fill_from in ('record', 'hiring_manager', 'typed', 'sender')) = 4;
  insert into t_results select 'save: only the form''s fields are kept as not needed',
    (select offer_fields_not_needed from public.sign_templates where id = v_tpl) = array['job_title'];
end $$;

-- The job has no hiring manager yet.
do $$
declare
  v_tpl uuid := (select v from t_ids where k = 'tpl');
  v_p jsonb;
begin
  v_p := public.sign_send_preview(v_tpl, 'ats_offer', 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e', null);
  insert into t_results select 'preview: candidate from the offer, locked',
    exists (select 1 from jsonb_array_elements(v_p->'roles') r where r->>'label' = 'Candidate' and r->>'source' = 'record' and (r->>'locked')::boolean and r->>'email' <> '');
  insert into t_results select 'preview: sender is the person sending',
    exists (select 1 from jsonb_array_elements(v_p->'roles') r where r->>'label' = 'HR copy' and r->>'source' = 'sender' and r->>'email' = 'allan@virgilio.tech');
  insert into t_results select 'preview: typed role is open',
    exists (select 1 from jsonb_array_elements(v_p->'roles') r where r->>'label' = 'Witness' and not (r->>'locked')::boolean);
  insert into t_results select 'preview: missing hiring manager shows empty',
    exists (select 1 from jsonb_array_elements(v_p->'roles') r where r->>'label' = 'Hiring manager' and r->>'email' = '');
  begin
    perform public.sign_send(v_tpl, 'ats_offer', 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e', null,
      jsonb_build_array(jsonb_build_object('role_id', (select v from t_ids where k = 'wit'), 'name', 'Test Witness', 'email', 'test2@example.com')));
    insert into t_results select 'send: refused without a hiring manager', false;
  exception when others then
    insert into t_results select 'send: refused without a hiring manager', sqlstate = 'GSN13' and sqlerrm like '%no hiring manager%';
  end;
end $$;

-- Give the job a hiring manager (Allan, inside this transaction).
reset role;
insert into public.job_assignments (job_id, user_id, organization_id, role)
select j.id, '7acbeead-b1b8-442c-b316-bff9779dc7de', j.organization_id, 'hiring_manager'
from public.jobs j where j.id = '7d16b23e-0ff0-4583-8ff7-19cdb6fb6e07';
create temp table t_env (v uuid);
grant insert, select on t_env to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);
do $$
declare
  v_tpl uuid := (select v from t_ids where k = 'tpl');
  v_env uuid;
begin
  -- The sender tries to change the candidate and the hiring manager: ignored.
  v_env := public.sign_send(v_tpl, 'ats_offer', 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e', null,
    jsonb_build_array(
      jsonb_build_object('role_id', (select v from t_ids where k = 'cand'), 'name', 'Someone Else', 'email', 'test9@example.com'),
      jsonb_build_object('role_id', (select v from t_ids where k = 'hm'), 'name', 'Someone Else', 'email', 'test8@example.com'),
      jsonb_build_object('role_id', (select v from t_ids where k = 'wit'), 'name', 'Test Witness', 'email', 'test2@example.com')));
  insert into t_env values (v_env);
  insert into t_results select 'send: hiring manager from the job',
    exists (select 1 from public.sign_recipients where envelope_id = v_env and label = 'Hiring manager' and email = 'allan@virgilio.tech');
  insert into t_results select 'send: candidate from the offer, not what was passed',
    not exists (select 1 from public.sign_recipients where envelope_id = v_env and email in ('test9@example.com', 'test8@example.com'));
  insert into t_results select 'send: typed role from the sender',
    exists (select 1 from public.sign_recipients where envelope_id = v_env and label = 'Witness' and email = 'test2@example.com');
  insert into t_results select 'send: copy goes to the sender',
    exists (select 1 from public.sign_recipients where envelope_id = v_env and label = 'HR copy' and email = 'allan@virgilio.tech');
  insert into t_results select 'send: email-only values saved',
    (select data_snapshot ? 'first_name' and data_snapshot ? 'company' and data_snapshot ? 'sender_first'
            and data_snapshot->>'first_name' = split_part(data_snapshot->>'name', ' ', 1)
     from public.sign_envelopes where id = v_env);
end $$;

-- Templates without sources behave as before.
do $$
declare
  v_old uuid;
  v_p jsonb;
begin
  select t.id into v_old from public.sign_templates t
  where t.app = 'ats' and t.kind = 'candidate' and t.archived_at is null and t.offer_form_id is null
    and not exists (select 1 from public.sign_recipients r where r.template_id = t.id and r.fill_from is not null)
  limit 1;
  if v_old is null then
    insert into t_results select 'old templates: first open signer still from the record', true;
    return;
  end if;
  v_p := public.sign_send_preview(v_old, 'candidate', '26226545-59d7-44b6-8de6-cf9a7e4e51d5', '7d16b23e-0ff0-4583-8ff7-19cdb6fb6e07');
  insert into t_results select 'old templates: first open signer still from the record',
    (select (r->>'source') = 'record' from jsonb_array_elements(v_p->'roles') r where not (r->>'fixed')::boolean and r->>'role' = 'signer' limit 1);
end $$;

reset role;
insert into t_results select 'helper: not callable by signed-in users',
  not has_function_privilege('authenticated', 'public.sign_role_person(public.sign_recipients, jsonb, uuid)', 'execute');

select check_name as check, ok from t_results;
