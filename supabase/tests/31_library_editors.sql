-- Run after 20261019040505_library_editors inside a transaction that is rolled back.
-- Signs in as three real Virgilio users (a platform admin, a workspace admin and
-- a member) and edits fake library rows; one real row of a dormant workspace is
-- only tried, never changed. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';   -- platform admin
  admin_ constant uuid := 'e9bfab1d-5e9a-49d0-af89-5f97ef89b6fe';  -- workspace admin
  member_ constant uuid := '61148617-e4e6-4d72-9176-67b203e98aae'; -- member
  other_source uuid := (select id from public.candidate_sources where tenant_id is not null and tenant_id <> '5ba7b145-f251-4b18-8900-724cb06028ab' order by created_at limit 1);
  other_ten uuid := (select tenant_id from public.candidate_sources where id = other_source);
  st uuid; rr uuid; fm uuid; n int; ok boolean; v text;
begin
  -- Fake rows, written as the database owner.
  insert into public.job_stages (stage_name, stage_type, is_default, is_active, tenant_id)
  values ('TEST library stage', 'screening', false, true, null) returning id into st;
  insert into public.rejection_reasons (tenant_id, name, category, source)
  values (ten, 'TEST library reason', 'recruiter_rejected', 'tenant') returning id into rr;

  -- ---------- the workspace admin ----------
  perform set_config('request.jwt.claims', json_build_object('sub', admin_, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into t_results values ('admin: is a library editor', public.library_editor());

  update public.job_stages set stage_description = 'edited' where id = st;
  get diagnostics n = row_count;
  insert into t_results values ('admin: edits a shared pipeline stage', n = 1);

  begin
    insert into public.application_fields (field_name, field_label, field_type, tenant_id) values ('test_lib', 'TEST lib', 'text', null);
    ok := true;
  exception when others then ok := false; end;
  insert into t_results values ('admin: adds a shared application field', ok);

  begin
    insert into public.offer_forms (name, is_active, tenant_id) values ('TEST library form', true, null) returning id into fm;
    insert into public.offer_form_fields (form_id, field_name, field_label, field_type, display_order) values (fm, 'test_lib', 'TEST lib', 'text', 0);
    ok := true;
  exception when others then ok := false; end;
  insert into t_results values ('admin: adds an offer form and a field on it', ok);

  update public.rejection_reasons set description = 'edited' where id = rr;
  get diagnostics n = row_count;
  insert into t_results values ('admin: edits a Virgilio rejection reason', n = 1);

  begin
    insert into public.email_templates (organization_id, name, subject, body) values (ten, 'TEST lib', 'Hi', 'Hello');
    ok := true;
  exception when others then ok := false; end;
  insert into t_results values ('admin: adds an email template', ok);

  update public.candidate_sources set description = 'touched' where id = other_source;
  get diagnostics n = row_count;
  insert into t_results values ('admin: another workspace''s source stays out of reach', other_source is not null and n = 0);

  begin
    insert into public.job_stages (stage_name, stage_type, tenant_id) values ('TEST other', 'screening', other_ten);
    v := 'allowed';
  exception when others then v := sqlstate; end;
  insert into t_results values ('admin: can''t add to another workspace (' || v || ')', v = '42501');

  -- ---------- a member ----------
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', member_, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into t_results values ('member: not a library editor', not public.library_editor());

  update public.job_stages set stage_description = 'member edit' where id = st;
  get diagnostics n = row_count;
  insert into t_results values ('member: can''t edit a shared stage', n = 0);

  begin
    insert into public.application_fields (field_name, field_label, field_type, tenant_id) values ('test_mem', 'TEST mem', 'text', null);
    v := 'allowed';
  exception when others then v := sqlstate; end;
  insert into t_results values ('member: can''t add a shared application field (' || v || ')', v = '42501');

  -- ---------- the platform admin ----------
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into t_results values ('platform admin: is a library editor', public.library_editor());
  update public.job_stages set stage_description = 'allan edit' where id = st;
  get diagnostics n = row_count;
  insert into t_results values ('platform admin: edits a shared stage', n = 1);

  execute 'reset role';
end $$;

insert into t_results select 'grants: signed-out visitors can''t ask',
  not has_function_privilege('anon', 'public.library_editor()', 'execute')
  and has_function_privilege('authenticated', 'public.library_editor()', 'execute');

select check_name as check, ok from t_results;
