-- Run after 20261023090000_os_person_performance inside a transaction that is rolled back.
-- Allan (an admin) reads the busiest recruiter's numbers and they match direct
-- counts. The person reads their own, another member is refused, and a bad
-- period is refused. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  busy uuid;
  other uuid;
  r jsonb;
  mine jsonb;
  st text;
  t0 constant timestamptz := '2000-01-01';
  t1 constant timestamptz := now() + interval '1 day';
begin
  -- The member who added the most candidates, and another active non-admin.
  select a.added_by into busy
  from public.job_candidate_associations a
  join public.jobs j on j.id = a.job_id and j.tenant_id = ten
  join public.members m on m.user_id = a.added_by and m.tenant_id = ten and m.user_status = 'active'
  where a.added_by is not null and a.added_by <> allan
  group by a.added_by order by count(*) desc limit 1;
  select m.user_id into other from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin' and m.user_id not in (allan, busy)
  order by m.created_at limit 1;

  -- 1. An admin reads them, and the numbers match direct counts.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  r := public.os_person_performance(ten, busy, t0, t1);
  perform set_config('role', 'postgres', true);
  insert into t_results values ('candidates added match',
    (r->>'added')::int = (select count(*) from public.job_candidate_associations a join public.jobs j on j.id = a.job_id and j.tenant_id = ten where a.added_by = busy));
  insert into t_results values ('interviews match',
    (r->>'interviews')::int = (select count(*) from public.activities x where x.tenant_id = ten and x.user_id = busy and x.activity_type = 'interview_scheduled'));
  insert into t_results values ('offers match',
    (r->>'offers')::int = (select count(*) from public.job_candidate_associations a join public.jobs j on j.id = a.job_id and j.tenant_id = ten where a.offered_by = busy and a.offered_at is not null));
  insert into t_results values ('hires count credited, uncancelled fills only',
    (r->>'hires')::int = (select count(*) from public.job_openings o where o.tenant_id = ten and o.cancelled_at is null and o.filled_at is not null and (o.sourcer_user_id = busy or o.recruiter_user_id = busy))
    and (r->>'hires_as_sourcer')::int + (r->>'hires_as_recruiter')::int >= (r->>'hires')::int);
  insert into t_results values ('the funnel narrows',
    (r->'funnel'->>'added')::int = (r->>'added')::int
    and (r->'funnel'->>'interviewed')::int <= (r->'funnel'->>'added')::int
    and (r->'funnel'->>'offered')::int <= (r->'funnel'->>'interviewed')::int
    and (r->'funnel'->>'hired')::int <= (r->'funnel'->>'offered')::int);
  insert into t_results values ('by job adds up',
    (select coalesce(sum((e->>'added')::int), 0) from jsonb_array_elements(r->'by_job') e) = (r->>'added')::int
    and (select coalesce(sum((e->>'hires')::int), 0) from jsonb_array_elements(r->'by_job') e) = (r->>'hires')::int
    and jsonb_array_length(r->'by_job') <= 100);
  insert into t_results values ('a period with nothing in it is all zeros',
    (select (x->>'added')::int + (x->>'interviews')::int + (x->>'offers')::int + (x->>'hires')::int = 0
            and jsonb_array_length(x->'by_job') = 0 and x->'fill_days_median' = 'null'::jsonb
     from (select public.os_person_performance(ten, busy, '2001-01-01', '2001-02-01') as x) z));

  -- 2. The person reads their own, the same numbers.
  perform set_config('request.jwt.claims', json_build_object('sub', busy, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  mine := public.os_person_performance(ten, busy, t0, t1);
  insert into t_results values ('the person reads their own', mine = r);

  -- 3. Another member is refused, and so is a backwards period.
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  begin
    perform public.os_person_performance(ten, busy, t0, t1);
    insert into t_results values ('another member can''t read them', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('another member can''t read them', st = 'GPF01');
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', busy, 'role', 'authenticated')::text, true);
  begin
    perform public.os_person_performance(ten, busy, t1, t0);
    insert into t_results values ('a backwards period is refused', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('a backwards period is refused', st = 'GPF02');
  end;
  perform set_config('role', 'postgres', true);
  insert into t_results values ('nobody signed out can call it',
    not has_function_privilege('anon', 'public.os_person_performance(uuid,uuid,timestamptz,timestamptz)', 'execute'));
end $$;

do $$ begin raise exception 'RESULTS %', (select count(*) filter (where ok) || ' of ' || count(*) || ' passed, failed: ' || coalesce(string_agg(check_name, ' | ') filter (where not ok), 'none') from t_results); end $$;
