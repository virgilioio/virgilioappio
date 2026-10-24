-- Run after 20261024150000_os_people_dashboard inside a transaction that is rolled back.
-- Birthdays and anniversaries come round on the right day (29 February on the
-- 28th), a birth date in the future is refused, a Nager.Date answer becomes
-- national holidays only, India has its fixed days, the dashboard is for admins
-- and counts the right people, every member sees day-and-month birthdays and
-- only their own country's holidays, and admins get one bell the day before
-- (never about themselves). Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  today date := public.os_today();
  mate uuid;
  other uuid;
  mate_name text;
  d jsonb;
  n int;
  st text;
begin
  insert into t_results values ('29 February falls on the 28th in other years', public.os_next_occurrence('2000-02-29', '2027-01-01') = '2027-02-28');
  insert into t_results values ('a day already past comes round next year', public.os_next_occurrence('1990-03-10', '2026-03-11') = '2027-03-10');
  insert into t_results values ('today counts as today', public.os_next_occurrence('1990-03-10', '2026-03-10') = '2026-03-10');

  select m.user_id into mate from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin' and m.user_id <> allan
  order by m.created_at limit 1;
  select m.user_id into other from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin' and m.user_id not in (allan, mate)
  order by m.created_at limit 1;
  select name into mate_name from public.os_active_people(ten) where user_id = mate;

  -- Mate turns a year older in ten days, Other tomorrow. Both live in Mexico.
  insert into public.os_person_details as x (tenant_id, user_id, birth_date, country_code)
  values (ten, mate, (today + 10 - interval '36 years')::date, 'MX'), (ten, other, (today + 1 - interval '30 years')::date, 'MX')
  on conflict (tenant_id, user_id) do update set birth_date = excluded.birth_date, country_code = excluded.country_code;
  begin
    update public.os_person_details set birth_date = today + 30 where tenant_id = ten and user_id = mate;
    insert into t_results values ('a birth date in the future is refused', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('a birth date in the future is refused', st = 'GOS02');
  end;
  select count(*) into n from public.os_audit_log
  where subject_user_id = mate and action = 'person.details_updated' and detail->'fields' ? 'birthday';
  insert into t_results values ('the history notes the birthday changed, never the date', n >= 1);

  -- Mate started three years ago, in five days.
  insert into public.os_person_work as w (tenant_id, user_id, start_date)
  values (ten, mate, (today + 5 - interval '3 years')::date)
  on conflict (tenant_id, user_id) do update set start_date = excluded.start_date;

  -- A Nager.Date answer: one national holiday and one regional one.
  insert into net._http_response (id, status_code, content, created)
  values (-424242, 200, jsonb_build_array(
      jsonb_build_object('date', today + 20, 'localName', 'Día de Prueba', 'name', 'Test Day', 'countryCode', 'MX', 'global', true, 'types', jsonb_build_array('Public')),
      jsonb_build_object('date', today + 21, 'localName', 'Día Regional', 'name', 'Regional Day', 'countryCode', 'MX', 'global', false, 'types', jsonb_build_array('Public'))
    )::text, now());
  insert into public.os_holiday_fetches (country_code, year, request_id, requested_at, attempts, status)
  values ('MX', 1999, -424242, now(), 1, 'waiting');
  perform public.os_holidays_sync(false);
  select count(*) into n from public.os_holidays where country_code = 'MX' and source = 'nager' and day = today + 20 and name = 'Test Day' and local_name = 'Día de Prueba';
  insert into t_results values ('a national holiday is saved', n = 1);
  select count(*) into n from public.os_holidays where name = 'Regional Day';
  insert into t_results values ('a regional holiday is left out', n = 0);
  select count(*) into n from public.os_holiday_fetches where country_code = 'MX' and year = 1999 and status = 'done' and holidays = 1;
  insert into t_results values ('the fetch is settled', n = 1);
  select count(*) into n from public.os_holidays where country_code = 'IN' and source = 'fixed' and extract(year from day) = extract(year from today);
  insert into t_results values ('India has its three national days', n = 3);
  -- Somewhere nobody here lives.
  insert into public.os_holidays (tenant_id, country_code, day, name, source) values (null, 'ES', today + 5, 'Spain Test Day', 'nager');

  -- The dashboard, as an admin.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  d := public.os_people_dashboard(ten);
  insert into t_results values ('birthdays in the next 30 days, in order',
    exists (select 1 from jsonb_array_elements(d->'birthdays') e where (e->>'user_id')::uuid = mate and (e->>'date')::date = today + 10)
    and exists (select 1 from jsonb_array_elements(d->'birthdays') e where (e->>'user_id')::uuid = other and (e->>'date')::date = today + 1)
    and not (d->'birthdays')::text like '%birth_date%');
  insert into t_results values ('a work anniversary counts its years',
    exists (select 1 from jsonb_array_elements(d->'anniversaries') e where (e->>'user_id')::uuid = mate and (e->>'years')::int = 3));
  insert into t_results values ('a holiday names who lives there',
    exists (select 1 from jsonb_array_elements(d->'holidays') e
            where e->>'name' = 'Test Day' and (e->>'people')::int >= 2 and e->'names' ? mate_name));
  insert into t_results values ('a holiday where nobody lives is left out',
    not exists (select 1 from jsonb_array_elements(d->'holidays') e where e->>'name' = 'Spain Test Day'));
  insert into t_results values ('people are counted by country',
    exists (select 1 from jsonb_array_elements(d->'by_country') e where e->>'country_code' = 'MX' and (e->>'people')::int >= 2)
    and (d->>'active')::int = (select count(*) from public.members m where m.tenant_id = ten and m.user_status = 'active' and m.user_id is not null));
  insert into t_results values ('missing details are listed, without a birthday once it is set',
    not exists (select 1 from jsonb_array_elements(d->'missing') e where (e->>'user_id')::uuid = mate and e->'missing' ? 'birthday')
    and not exists (select 1 from jsonb_array_elements(d->'missing') e where (e->>'user_id')::uuid = mate and e->'missing' ? 'country'));

  -- Only admins see it.
  perform set_config('request.jwt.claims', json_build_object('sub', mate, 'role', 'authenticated')::text, true);
  begin
    perform public.os_people_dashboard(ten);
    insert into t_results values ('a member can''t open the dashboard', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('a member can''t open the dashboard', st = 'GPD01');
  end;

  -- Every member's calendar: day-and-month birthdays, their own country's holidays.
  d := public.os_team_calendar(ten);
  insert into t_results values ('a member sees teammates'' birthdays, never the year',
    exists (select 1 from jsonb_array_elements(d->'birthdays') e where (e->>'user_id')::uuid = other and (e->>'date')::date = today + 1)
    and not (d->'birthdays')::text like '%birth_date%' and not (d->'birthdays')::text like '%' || extract(year from today - interval '30 years')::int || '-%');
  insert into t_results values ('a member sees holidays where they live, not elsewhere',
    exists (select 1 from jsonb_array_elements(d->'holidays') e where e->>'name' = 'Test Day')
    and not exists (select 1 from jsonb_array_elements(d->'holidays') e where e->>'name' = 'Spain Test Day'));
  begin
    insert into public.os_holidays (tenant_id, country_code, day, name, source) values (ten, 'MX', today + 7, 'Member day', 'manual');
    insert into t_results values ('a member can''t add a day off', false);
  exception when insufficient_privilege then
    insert into t_results values ('a member can''t add a day off', true);
  end;

  -- An admin adds the workspace's own day off: everyone sees it.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  insert into public.os_holidays (tenant_id, country_code, day, name, source) values (ten, 'MX', today + 7, 'Virgilio day off', 'manual');
  perform set_config('request.jwt.claims', json_build_object('sub', mate, 'role', 'authenticated')::text, true);
  d := public.os_team_calendar(ten);
  insert into t_results values ('the workspace''s own day off reaches everyone',
    exists (select 1 from jsonb_array_elements(d->'holidays') e where e->>'name' = 'Virgilio day off' and (e->>'own')::boolean));

  -- The bell the day before: Other's birthday and a workspace day off, both tomorrow.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  insert into public.os_holidays (tenant_id, country_code, day, name, source) values (ten, 'MX', today + 1, 'Bell Test Day', 'manual');
  n := public.os_people_bells();
  select count(*) into n from public.notifications
  where user_id = allan and metadata->>'kind' = 'holiday_tomorrow' and title = 'Tomorrow is Bell Test Day' and category::text = 'team';
  insert into t_results values ('admins hear about tomorrow''s day off', n = 1);
  select count(*) into n from public.notifications
  where user_id = allan and metadata->>'kind' = 'birthday_tomorrow' and metadata->>'subject' = other::text;
  insert into t_results values ('admins hear about tomorrow''s birthday', n = 1);
  select count(*) into n from public.notifications
  where user_id = other and metadata->>'kind' = 'birthday_tomorrow' and metadata->>'subject' = other::text;
  insert into t_results values ('never about their own birthday', n = 0);
  perform public.os_people_bells();
  select count(*) into n from public.notifications
  where user_id = allan and metadata->>'kind' = 'birthday_tomorrow' and metadata->>'subject' = other::text;
  insert into t_results values ('a second run rings no one twice', n = 1);
end $$;

do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n') into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
