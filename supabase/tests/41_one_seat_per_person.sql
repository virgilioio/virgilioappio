-- Run after 20261023120000_one_seat_per_person inside a transaction that is rolled back.
-- Takes one real seat on a live job and a teammate with no seat on it, then tries
-- every way of doubling someone up. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

do $$
declare
  seat public.job_assignments%rowtype;
  other uuid;
  other_name text;
  new_id uuid;
  msg text;
  st text;
begin
  insert into t_results values ('index: one live seat per person per job',
    exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'job_assignments'
            and indexname = 'job_assignments_one_seat_per_person'
            and indexdef ilike '%unique%(job_id, user_id)%deleted_at is null%'));
  insert into t_results values ('index: live data already holds one seat per person',
    not exists (select 1 from public.job_assignments where deleted_at is null
                group by job_id, user_id having count(*) > 1));
  insert into t_results values ('a seat written without a role is an interviewer',
    (select column_default from information_schema.columns where table_schema = 'public'
       and table_name = 'job_assignments' and column_name = 'role') like '''interviewer''%');

  select ja.* into seat from public.job_assignments ja
  join public.jobs j on j.id = ja.job_id and j.deleted_at is null
  where ja.deleted_at is null and ja.role = 'hiring_manager'
  order by ja.created_at limit 1;

  select ja.user_id into other from public.job_assignments ja
  where ja.deleted_at is null and ja.organization_id = seat.organization_id and ja.user_id <> seat.user_id
    and not exists (select 1 from public.job_assignments x where x.job_id = seat.job_id
                    and x.user_id = ja.user_id and x.deleted_at is null)
  limit 1;

  select coalesce(nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), email)
    into other_name from public.profiles where user_id = seat.user_id;

  -- 1. The same person again, under another role --------------------------------------
  begin
    insert into public.job_assignments (job_id, user_id, organization_id, role)
    values (seat.job_id, seat.user_id, seat.organization_id, 'recruiter');
    insert into t_results values ('second role for the same person is refused', false);
  exception when others then
    get stacked diagnostics msg = message_text, st = returned_sqlstate;
    insert into t_results values ('second role for the same person is refused', st = 'GJT01');
    insert into t_results values ('the refusal names the person and their seat',
      msg = other_name || ' is already on this job as Hiring manager.');
  end;

  -- 2. Moving another seat onto the same person --------------------------------------
  insert into public.job_assignments (job_id, user_id, organization_id)
  values (seat.job_id, other, seat.organization_id) returning id into new_id;
  insert into t_results values ('a new seat with no role is an interviewer',
    (select role from public.job_assignments where id = new_id) = 'interviewer');
  begin
    update public.job_assignments set user_id = seat.user_id where id = new_id;
    insert into t_results values ('handing a seat to someone already on the job is refused', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('handing a seat to someone already on the job is refused', st = 'GJT01');
  end;

  -- 3. Changing a role moves the seat, it doesn't add one -----------------------------
  update public.job_assignments set role = 'sourcer' where id = new_id;
  insert into t_results values ('changing a role keeps one seat',
    (select count(*) from public.job_assignments where job_id = seat.job_id and user_id = other and deleted_at is null) = 1
    and (select role from public.job_assignments where id = new_id) = 'sourcer');

  -- 4. A removed seat doesn't count, and can't come back as a second one ---------------
  update public.job_assignments set deleted_at = now() where id = new_id;
  insert into public.job_assignments (job_id, user_id, organization_id, role)
  values (seat.job_id, other, seat.organization_id, 'hiring_manager');
  insert into t_results values ('a removed seat doesn''t block adding the person again', true);
  begin
    update public.job_assignments set deleted_at = null where id = new_id;
    insert into t_results values ('restoring a removed seat beside a live one is refused', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('restoring a removed seat beside a live one is refused', st = 'GJT01');
  end;

  -- 5. Several hiring managers stay possible, as different people ----------------------
  insert into t_results values ('two different hiring managers on one job are fine',
    (select count(distinct user_id) from public.job_assignments
      where job_id = seat.job_id and role = 'hiring_manager' and deleted_at is null) >= 2);
end $$;

select * from t_results;
