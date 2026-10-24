-- Run after 20261024143441_external_users inside a transaction that is rolled back.
-- Client accounts became external and Virgilio people stayed members; a new
-- invite follows its email address; an external can't be an admin; People &
-- Access keeps nothing for them and gives them no other app; they can be a
-- hiring manager or interviewer but never a Recruiter or Sourcer, nor credited
-- on a hire; they don't see the team calendar or useful links; admins don't
-- see them in People & Access and the dashboard doesn't count them, while they
-- still read their own row. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  alex uuid;
  job uuid;
  opening uuid;
  n int;
  t text;
  st text;
  d jsonb;
begin
  select m.user_id into alex from public.members m join public.profiles p on p.user_id = m.user_id
  where m.tenant_id = ten and p.last_name ilike 'westwood';
  insert into t_results values ('Alex Westwood is external',
    (select user_type::text from public.members where tenant_id = ten and user_id = alex) = 'external');
  select count(*) into n from public.members m left join public.profiles p on p.user_id = m.user_id
  where m.tenant_id = ten and m.user_type::text = 'external' and lower(coalesce(p.email, m.invited_email)) like '%@virgilio.tech';
  insert into t_results values ('nobody at virgilio.tech is external', n = 0);
  select count(*) into n from public.members m left join public.profiles p on p.user_id = m.user_id
  where m.tenant_id = ten and m.user_type::text = 'member' and lower(coalesce(p.email, m.invited_email)) not like '%@virgilio.tech';
  insert into t_results values ('every other address in the workspace is external', n = 0);

  -- A new invite follows its email address.
  insert into public.members (organization_id, tenant_id, invited_email, user_status, system_role, user_type)
  values (ten, ten, 'hm.test@client-example.com', 'invited', 'member', 'member');
  insert into public.members (organization_id, tenant_id, invited_email, user_status, system_role, user_type)
  values (ten, ten, 'new.test@virgilio.tech', 'invited', 'member', 'member');
  insert into t_results values ('a client invite comes in external',
    (select user_type::text from public.members where invited_email = 'hm.test@client-example.com') = 'external');
  insert into t_results values ('a virgilio.tech invite comes in a member',
    (select user_type::text from public.members where invited_email = 'new.test@virgilio.tech') = 'member');
  begin
    update public.members set system_role = 'admin' where tenant_id = ten and user_id = alex;
    insert into t_results values ('an external can''t be an admin', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('an external can''t be an admin', st = 'GEX01');
  end;

  -- People & Access keeps nothing for them.
  begin
    insert into public.os_person_details (tenant_id, user_id, country_code) values (ten, alex, 'MX');
    insert into t_results values ('no personal details for an external', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('no personal details for an external', st = 'GEX02');
  end;
  begin
    insert into public.os_person_work (tenant_id, user_id, max_open_jobs) values (ten, alex, 5);
    insert into t_results values ('no work profile for an external', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('no work profile for an external', st = 'GEX02');
  end;
  begin
    insert into public.os_person_profile (tenant_id, user_id, bundle_id)
    values (ten, alex, (select id from public.os_bundles where tenant_id = ten limit 1));
    insert into t_results values ('no job role for an external', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('no job role for an external', st = 'GEX02');
  end;
  begin
    insert into public.os_app_grants (tenant_id, user_id, app_key, role) values (ten, alex, 'sales', 'rep');
    insert into t_results values ('no Gio Sales for an external', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('no Gio Sales for an external', st = 'GEX02');
  end;

  -- Hiring manager or interviewer, never Recruiter, Sourcer or credited.
  select ja.job_id into job from public.job_assignments ja where ja.user_id = alex and ja.deleted_at is null limit 1;
  begin
    update public.job_assignments set role = 'recruiter' where user_id = alex and job_id = job;
    insert into t_results values ('an external can''t be a Recruiter', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate; get stacked diagnostics t = message_text;
    insert into t_results values ('an external can''t be a Recruiter, by name', st = 'GEX03' and t ilike 'Alex%Recruiter%');
  end;
  update public.job_assignments set role = 'interviewer' where user_id = alex and job_id = job;
  insert into t_results values ('an external can be an interviewer',
    exists (select 1 from public.job_assignments where user_id = alex and job_id = job and role::text = 'interviewer'));
  select o.id into opening from public.job_openings o where o.filled_at is null and o.cancelled_at is null
    and o.tenant_id = ten limit 1;
  begin
    update public.job_openings set sourcer_user_id = alex where id = opening;
    insert into t_results values ('an external is never credited on a hire', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('an external is never credited on a hire', st = 'GEX03');
  end;

  insert into public.os_useful_links (tenant_id, title, url) values (ten, 'Team handbook test', 'https://example.com/handbook');

  -- As Alex.
  perform set_config('request.jwt.claims', json_build_object('sub', alex, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    d := public.os_team_calendar(ten);
    insert into t_results values ('an external doesn''t see the team calendar', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('an external doesn''t see the team calendar', st = 'GPD01');
  end;
  select count(*) into n from public.os_useful_links where tenant_id = ten;
  insert into t_results values ('an external doesn''t see useful links', n = 0);
  select count(*) into n from public.os_people(ten);
  insert into t_results values ('an external still reads their own row', n = 1);

  -- As Allan.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  select count(*) into n from public.os_useful_links where tenant_id = ten and title = 'Team handbook test';
  insert into t_results values ('Virgilio people still see useful links', n = 1);
  select count(*) into n from public.os_people(ten) where user_type = 'external';
  insert into t_results values ('People & Access doesn''t list externals', n = 0);
  select count(*) into n from public.os_people(ten) where user_type = 'member';
  insert into t_results values ('People & Access still lists Virgilio people', n > 5);
  d := public.os_people_dashboard(ten);
  insert into t_results values ('the dashboard doesn''t count externals',
    (d->>'active')::int = (select count(*) from public.members m where m.tenant_id = ten and m.user_status = 'active'
      and m.user_type::text <> 'external'));
  insert into t_results values ('nor their invitations',
    (d->>'invited')::int = (select count(*) from public.members m where m.tenant_id = ten and m.user_status = 'invited'
      and m.user_type::text <> 'external'));
  insert into t_results values ('externals aren''t among the missing information',
    not exists (select 1 from jsonb_array_elements(d->'missing') e where (e->>'user_id')::uuid = alex));
  d := public.os_team_calendar(ten);
  insert into t_results values ('Virgilio people still see the team calendar', d ? 'birthdays');
end $$;

do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n') into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
