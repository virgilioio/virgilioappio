-- Run after 20261022224455_os_person_details inside a transaction that is rolled back.
-- Allan (an admin) fills in a teammate's details; the teammate edits their own;
-- another member can neither read nor write them. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  mate uuid;
  other uuid;
  outsider uuid;
  n int;
  st text;
  row_ public.os_person_details%rowtype;
begin
  -- Two active non-admin members besides Allan.
  select m.user_id into mate from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin' and m.user_id <> allan
  order by m.created_at limit 1;
  select m.user_id into other from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin' and m.user_id not in (allan, mate)
  order by m.created_at limit 1;
  -- Someone with an account who isn't in this workspace (looked up before acting as a user).
  select u.id into outsider from auth.users u
  where not exists (select 1 from public.members m where m.user_id = u.id and m.tenant_id = ten) limit 1;

  -- 1. An admin fills them in; blanks become null, the email is lowered.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.os_person_details (tenant_id, user_id, personal_email, personal_phone, country_code, region, city)
  values (ten, mate, '  Maya.Personal@Example.com ', '+52 55 1234 5678', 'mx', ' Ciudad de México ', '   ');
  select * into row_ from public.os_person_details where tenant_id = ten and user_id = mate;
  insert into t_results values ('an admin can add someone''s details',
    row_.personal_email = 'maya.personal@example.com' and row_.country_code = 'MX' and row_.region = 'Ciudad de México' and row_.city is null);
  insert into t_results values ('the change is recorded with its admin, by field, without values',
    exists (select 1 from public.os_audit_log a where a.subject_user_id = mate and a.action = 'person.details_updated'
            and a.actor_id = allan and a.detail->'fields' ? 'personal_email' and a.detail->'fields' ? 'country'
            and a.detail::text not like '%example.com%' and a.detail::text not like '%1234%'));

  -- 2. A bad email or phone is refused.
  begin
    update public.os_person_details set personal_email = 'not-an-email' where tenant_id = ten and user_id = mate;
    insert into t_results values ('a malformed email is refused', false);
  exception when check_violation then
    insert into t_results values ('a malformed email is refused', true);
  end;
  begin
    update public.os_person_details set personal_phone = 'call me' where tenant_id = ten and user_id = mate;
    insert into t_results values ('a malformed phone is refused', false);
  exception when check_violation then
    insert into t_results values ('a malformed phone is refused', true);
  end;

  -- 3. The person edits their own.
  perform set_config('request.jwt.claims', json_build_object('sub', mate, 'role', 'authenticated')::text, true);
  update public.os_person_details set city = 'Coyoacán' where tenant_id = ten and user_id = mate;
  get diagnostics n = row_count;
  insert into t_results values ('the person can edit their own details', n = 1);
  insert into t_results values ('and read them',
    (select city from public.os_person_details where tenant_id = ten and user_id = mate) = 'Coyoacán');

  -- 4. Another member can't see or change them, nor add details for someone else.
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  select count(*) into n from public.os_person_details where user_id = mate;
  insert into t_results values ('another member can''t read them', n = 0);
  update public.os_person_details set city = 'Elsewhere' where tenant_id = ten and user_id = mate;
  get diagnostics n = row_count;
  insert into t_results values ('another member can''t change them', n = 0);
  begin
    insert into public.os_person_details (tenant_id, user_id, city) values (ten, mate, 'Elsewhere');
    insert into t_results values ('another member can''t add details for someone else', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('another member can''t add details for someone else', st in ('42501', '23505'));
  end;

  -- 5. Details only exist for members of the workspace.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  begin
    insert into public.os_person_details (tenant_id, user_id, city)
    values (ten, outsider, 'X');
    insert into t_results values ('someone outside the workspace is refused', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('someone outside the workspace is refused', st = 'GOS02');
  end;
  perform set_config('role', 'postgres', true);
end $$;

select * from t_results;
