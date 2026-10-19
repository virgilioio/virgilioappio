-- Run after 20261019042407_library_stage_retire inside a transaction that is rolled back.
-- Fake stages no job uses; signs in as real Virgilio users. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';   -- platform admin
  admin_ constant uuid := 'e9bfab1d-5e9a-49d0-af89-5f97ef89b6fe';  -- workspace admin
  member_ constant uuid := '61148617-e4e6-4d72-9176-67b203e98aae'; -- member
  g1 uuid; g2 uuid; g3 uuid; t1 uuid; v text;
begin
  insert into public.job_stages (stage_name, stage_type, is_active, tenant_id) values ('TEST shared one', 'screening', true, null) returning id into g1;
  insert into public.job_stages (stage_name, stage_type, is_active, tenant_id) values ('TEST shared two', 'screening', true, null) returning id into g2;
  insert into public.job_stages (stage_name, stage_type, is_active, tenant_id) values ('TEST shared three', 'screening', true, null) returning id into g3;
  insert into public.job_stages (stage_name, stage_type, is_active, tenant_id) values ('TEST ours', 'screening', true, ten) returning id into t1;

  -- the workspace admin
  perform set_config('request.jwt.claims', json_build_object('sub', admin_, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.retire_global_job_stage(g1); v := 'ok'; exception when others then v := sqlstate || ' ' || sqlerrm; end;
  insert into t_results values ('admin: removes a shared stage (' || v || ')', v = 'ok');
  begin perform public.retire_tenant_job_stage(t1); v := 'ok'; exception when others then v := sqlstate || ' ' || sqlerrm; end;
  insert into t_results values ('admin: removes a Virgilio stage (' || v || ')', v = 'ok');

  -- a member
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', member_, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.retire_global_job_stage(g2); v := 'ok'; exception when others then v := 'refused'; end;
  insert into t_results values ('member: can''t remove a shared stage', v = 'refused');

  -- the platform admin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.retire_global_job_stage(g3); v := 'ok'; exception when others then v := sqlstate || ' ' || sqlerrm; end;
  insert into t_results values ('platform admin: removes a shared stage (' || v || ')', v = 'ok');
  execute 'reset role';

  insert into t_results values ('removed stages are inactive, not gone; the member''s stays',
    (select count(*) = 3 from public.job_stages where id in (g1, g3, t1) and not is_active)
    and (select is_active from public.job_stages where id = g2));
end $$;

select check_name as check, ok from t_results;
