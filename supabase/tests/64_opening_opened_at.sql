-- Run after 20261026073011_opening_opened_at inside a transaction that is rolled back.
-- Openings know when they started; time to fill is measured from then and is
-- never negative; a browser can't move the start. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  n int;
  draft_job uuid;
  open_job uuid;
  o_draft uuid;
  o_open uuid;
  started timestamptz;
  perf jsonb;
begin
  -- 1. The openings made on 2026-10-03 start when their job was created.
  select count(*) into n from public.job_openings o join public.jobs j on j.id = o.job_id
  where o.created_at = '2026-10-03 18:56:47.678716+00' and o.opened_at is distinct from j.created_at;
  insert into t_results values ('the October openings start when their job was created', n = 0);
  select count(*) into n from public.job_openings o join public.jobs j on j.id = o.job_id
  where o.opened_at is null and j.status::text <> 'draft';
  insert into t_results values ('every opening on a job past draft has a start', n = 0);

  -- 2. Time to fill is measured from the start and is never negative.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perf := public.os_person_performance(ten, allan, '2000-01-01', now() + interval '1 day');
  insert into t_results values ('the median is positive when there are hires',
    (perf->>'hires')::int = 0 or (perf->>'fill_days_median')::numeric > 0);
  insert into t_results values ('it matches the hires measured from their start',
    (perf->>'fill_days_median')::numeric is not distinct from (
      select round((percentile_cont(0.5) within group (order by extract(epoch from (o.filled_at - o.opened_at)) / 86400))::numeric, 1)
      from public.job_openings o
      where o.tenant_id = ten and o.cancelled_at is null and o.filled_at is not null
        and (o.sourcer_user_id = allan or o.recruiter_user_id = allan)
        and o.opened_at is not null and o.filled_at >= o.opened_at));
  perform set_config('role', 'postgres', true);

  -- 3. A new opening on an open job starts now; on a draft job it waits.
  -- A job with no Gio Sales deal (a deal caps its openings). For the draft
  -- case it goes back to draft for the test, then leaves draft again.
  select id into open_job from public.jobs where tenant_id = ten and status::text = 'open' and sales_deal_id is null order by created_at desc limit 1;
  insert into public.job_openings (tenant_id, job_id, req_id, target_hire_date, target_start_date, opened_at)
  values (ten, open_job, 'TEST-OPEN-1', current_date + 30, current_date + 44, '2001-01-01')
  returning id, opened_at into o_open, started;
  insert into t_results values ('a new opening on an open job starts now, whatever is sent', started = now());
  select id into draft_job from public.jobs where tenant_id = ten and status::text = 'open' and sales_deal_id is null and id <> open_job order by created_at desc limit 1;
  update public.jobs set status = 'draft' where id = draft_job;
  insert into public.job_openings (tenant_id, job_id, req_id, target_hire_date, target_start_date)
  values (ten, draft_job, 'TEST-DRAFT-1', current_date + 30, current_date + 44)
  returning id, opened_at into o_draft, started;
  insert into t_results values ('a new opening on a draft job has no start yet', started is null);
  -- Leaving draft by closing it (opening it would run the publish checklist).
  update public.jobs set status = 'closed' where id = draft_job;
  insert into t_results values ('it starts when the job leaves draft',
    (select opened_at from public.job_openings where id = o_draft) = now());

  -- 4. A browser can't move the start.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update public.job_openings set opened_at = '2001-01-01' where id = o_open;
  insert into t_results values ('a browser can''t move the start',
    (select opened_at from public.job_openings where id = o_open) = now());
  perform set_config('role', 'postgres', true);
end $$;

-- Raise the results so the whole run rolls back, wherever it runs.
do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n') into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
