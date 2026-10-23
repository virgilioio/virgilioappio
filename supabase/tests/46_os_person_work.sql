-- Run after 20261023000000_os_person_work inside a transaction that is rolled back.
-- Allan (an admin) sets a teammate's work profile and rating; teammates read the
-- work profile but can't change it or see the rating; nobody rates themself.
-- Every row's ok is true.
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
  w public.os_person_work%rowtype;
  r public.os_person_rating%rowtype;
begin
  select m.user_id into mate from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin' and m.user_id <> allan
  order by m.created_at limit 1;
  select m.user_id into other from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin' and m.user_id not in (allan, mate)
  order by m.created_at limit 1;
  select u.id into outsider from auth.users u
  where not exists (select 1 from public.members m where m.user_id = u.id and m.tenant_id = ten) limit 1;

  -- 1. An admin sets the work profile; duplicates go, segments keep their order.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.os_person_work (tenant_id, user_id, segments, specialties, max_open_jobs)
  values (ten, mate, array['ent', 'smb', 'ent'], array['sales', 'customer_success', 'sales'], 12);
  select * into w from public.os_person_work where tenant_id = ten and user_id = mate;
  insert into t_results values ('an admin sets segments, specialties and capacity',
    w.segments = array['smb', 'ent'] and w.specialties = array['customer_success', 'sales'] and w.max_open_jobs = 12);
  insert into t_results values ('the history records the new values',
    exists (select 1 from public.os_audit_log a where a.subject_user_id = mate and a.action = 'person.work_updated'
            and a.actor_id = allan and a.detail->'segments' = '["smb", "ent"]'::jsonb and (a.detail->>'max_open_jobs')::int = 12));

  -- 2. Values outside the lists are refused.
  begin
    update public.os_person_work set segments = array['smb', 'startup'] where tenant_id = ten and user_id = mate;
    insert into t_results values ('an unknown segment is refused', false);
  exception when check_violation then
    insert into t_results values ('an unknown segment is refused', true);
  end;
  begin
    update public.os_person_work set specialties = array['AE'] where tenant_id = ten and user_id = mate;
    insert into t_results values ('an unknown specialty is refused', false);
  exception when check_violation then
    insert into t_results values ('an unknown specialty is refused', true);
  end;
  begin
    update public.os_person_work set max_open_jobs = 0 where tenant_id = ten and user_id = mate;
    insert into t_results values ('a capacity of 0 is refused', false);
  exception when check_violation then
    insert into t_results values ('a capacity of 0 is refused', true);
  end;

  -- 3. An admin rates them; the note is kept out of the history.
  insert into public.os_person_rating (tenant_id, user_id, rating, note)
  values (ten, mate, 4, 'Strong closer; slow on intake calls.');
  select * into r from public.os_person_rating where tenant_id = ten and user_id = mate;
  insert into t_results values ('an admin rates someone, signed and dated',
    r.rating = 4 and r.rated_by = allan and r.rated_at is not null);
  insert into t_results values ('the history has the rating but not the note',
    exists (select 1 from public.os_audit_log a where a.subject_user_id = mate and a.action = 'person.rating_updated'
            and (a.detail->>'rating')::int = 4 and a.detail->>'note_changed' = 'true'
            and a.detail::text not like '%closer%'));
  begin
    update public.os_person_rating set rating = 6 where tenant_id = ten and user_id = mate;
    insert into t_results values ('a rating above 5 is refused', false);
  exception when check_violation then
    insert into t_results values ('a rating above 5 is refused', true);
  end;
  begin
    insert into public.os_person_rating (tenant_id, user_id, rating) values (ten, allan, 5);
    insert into t_results values ('nobody rates themself', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('nobody rates themself', st = 'GOS03');
  end;

  -- 4. A teammate reads the work profile but can't change it, and never sees the rating.
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  select count(*) into n from public.os_person_work where tenant_id = ten and user_id = mate;
  insert into t_results values ('a teammate reads the work profile', n = 1);
  update public.os_person_work set max_open_jobs = 99 where tenant_id = ten and user_id = mate;
  get diagnostics n = row_count;
  insert into t_results values ('a teammate can''t change it', n = 0);
  select count(*) into n from public.os_person_rating where user_id = mate;
  insert into t_results values ('a teammate can''t read the rating', n = 0);
  update public.os_person_rating set rating = 1 where tenant_id = ten and user_id = mate;
  get diagnostics n = row_count;
  insert into t_results values ('or change it', n = 0);
  begin
    insert into public.os_person_work (tenant_id, user_id, max_open_jobs) values (ten, other, 50);
    insert into t_results values ('a member can''t set up their own work profile', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('a member can''t set up their own work profile', st = '42501');
  end;

  -- 5. The person can see their work profile, not their rating, and can't edit either.
  perform set_config('request.jwt.claims', json_build_object('sub', mate, 'role', 'authenticated')::text, true);
  select count(*) into n from public.os_person_rating where user_id = mate;
  insert into t_results values ('the person can''t read their own rating', n = 0);
  update public.os_person_work set max_open_jobs = 99 where tenant_id = ten and user_id = mate;
  get diagnostics n = row_count;
  insert into t_results values ('the person can''t change their own capacity', n = 0);

  -- 6. Only workspace members; an unchanged save leaves no trace.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  begin
    insert into public.os_person_work (tenant_id, user_id, max_open_jobs) values (ten, outsider, 5);
    insert into t_results values ('someone outside the workspace is refused', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('someone outside the workspace is refused', st = 'GOS02');
  end;
  update public.os_person_rating set note = 'Strong closer; slow on intake calls.' where tenant_id = ten and user_id = mate;
  insert into t_results values ('saving an unchanged rating adds nothing to the history',
    (select count(*) from public.os_audit_log a where a.subject_user_id = mate and a.action = 'person.rating_updated') = 1);
  perform set_config('role', 'postgres', true);
end $$;

select * from t_results;
