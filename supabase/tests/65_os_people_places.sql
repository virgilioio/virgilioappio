-- Run after 20261026210000_os_people_places inside a transaction that is rolled back.
-- The dashboard places people city by city: the city of that name in their
-- country, the one in their state when it says which, the biggest otherwise;
-- an unlisted city or no city comes back without coordinates. Still admins
-- only. Every row's ok is true. Uses a made-up country, ZZ, and its cities.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  a uuid; b uuid; c uuid; e uuid; nonadmin uuid;
  d jsonb;
  zz jsonb;
  st text;
begin
  select user_id into a from public.os_active_people(ten) where user_id <> allan order by name limit 1;
  select user_id into b from public.os_active_people(ten) where user_id not in (allan, a) order by name limit 1;
  select user_id into c from public.os_active_people(ten) where user_id not in (allan, a, b) order by name limit 1;
  select user_id into e from public.os_active_people(ten) where user_id not in (allan, a, b, c) order by name limit 1;

  insert into public.geo_regions (country_code, code, name, ascii_name) values
    ('ZZ', '01', 'Nuevo León', 'Nuevo Leon'), ('ZZ', '02', 'Coahuila', 'Coahuila');
  insert into public.geo_cities (id, country_code, region_code, name, ascii_name, population, latitude, longitude) values
    (-1, 'ZZ', '01', 'San Pedro', 'San Pedro', 1000, 25.66, -100.40),
    (-2, 'ZZ', '02', 'San Pedro', 'San Pedro', 50000, 25.76, -102.98),
    (-3, 'ZZ', '01', 'Monterrey', 'Monterrey', 1100000, 25.67, -100.31);

  -- a and b in San Pedro, Nuevo León (the smaller one); c in a town that isn't listed; e with no city.
  insert into public.os_person_details (tenant_id, user_id, country_code, region, city) values
    (ten, a, 'ZZ', 'Nuevo León', 'San Pedro'), (ten, b, 'ZZ', 'nuevo leon', 'SAN PEDRO'),
    (ten, c, 'ZZ', null, 'Pueblito'), (ten, e, 'ZZ', null, null)
  on conflict (tenant_id, user_id) do update set country_code = excluded.country_code, region = excluded.region, city = excluded.city;

  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  d := public.os_people_dashboard(ten);
  select coalesce(jsonb_agg(p), '[]'::jsonb) into zz from jsonb_array_elements(d->'places') p where p->>'country_code' = 'ZZ';

  insert into t_results values ('the dashboard still returns its other parts',
    d ? 'by_country' and d ? 'birthdays' and d ? 'missing');
  insert into t_results values ('one place per city, case and accents aside',
    jsonb_array_length(zz) = 3);
  insert into t_results values ('the state picks the right San Pedro, and both people are on it',
    exists (select 1 from jsonb_array_elements(zz) p
            where p->>'city' ilike 'san pedro' and (p->>'lat')::numeric = 25.66 and (p->>'lng')::numeric = -100.40
              and jsonb_array_length(p->'people') = 2));
  insert into t_results values ('a city that isn''t listed has no coordinates',
    exists (select 1 from jsonb_array_elements(zz) p where p->>'city' = 'Pueblito' and p->'lat' = 'null'::jsonb));
  insert into t_results values ('someone with no city is still counted in their country',
    exists (select 1 from jsonb_array_elements(zz) p where p->'city' = 'null'::jsonb and jsonb_array_length(p->'people') = 1));
  insert into t_results values ('each person comes with their name and profile',
    exists (select 1 from jsonb_array_elements(zz) p, jsonb_array_elements(p->'people') x
            where x->>'user_id' = a::text and x ? 'member_id' and x ? 'name'));

  -- Still People & Access admins only: the first active member who isn't one can't read it.
  for nonadmin in
    select m.user_id from public.members m
    where m.tenant_id = ten and m.user_status = 'active' and m.user_type::text <> 'external' and m.user_id <> allan
    order by m.created_at
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', nonadmin, 'role', 'authenticated')::text, true);
    continue when public.is_os_admin(ten);
    begin
      perform public.os_people_dashboard(ten);
      insert into t_results values ('a member who isn''t an admin can''t read it', false);
    exception when others then
      get stacked diagnostics st = returned_sqlstate;
      insert into t_results values ('a member who isn''t an admin can''t read it', st = 'GPD01');
    end;
    exit;
  end loop;
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
