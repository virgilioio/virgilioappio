-- Run after 20261026150000_places_and_shipping inside a transaction that is rolled back.
-- Places: anyone reads them (the careers pages too), only the server writes,
-- and the city search folds accents and ranks by size. Shipping addresses:
-- the person and People & Access admins only, never an external, history by
-- field without values. Every row's ok is true.
-- Before GeoNames is loaded the place checks use a few rows added here.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to anon, authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  mate uuid;
  other uuid;
  alex uuid;
  n int;
  st text;
  names text;
  row_ public.os_person_shipping%rowtype;
begin
  select m.user_id into mate from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin'
    and m.user_type::text <> 'external' and m.user_id <> allan
  order by m.created_at limit 1;
  select m.user_id into other from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.system_role::text <> 'admin'
    and m.user_type::text <> 'external' and m.user_id not in (allan, mate)
  order by m.created_at limit 1;
  select m.user_id into alex from public.members m
  where m.tenant_id = ten and m.user_type::text = 'external' order by m.created_at limit 1;

  -- Places to search (as the loader would write them).
  insert into public.geo_regions (country_code, code, name, ascii_name) values
    ('ZZ', '01', 'Nuevo León', 'Nuevo Leon'), ('ZZ', '02', 'Jalisco', 'Jalisco')
  on conflict do nothing;
  insert into public.geo_cities (id, country_code, region_code, name, ascii_name, population) values
    (-1, 'ZZ', '01', 'San Pedro Garza García', 'San Pedro Garza Garcia', 132000),
    (-2, 'ZZ', '01', 'Monterrey', 'Monterrey', 1100000),
    (-3, 'ZZ', '02', 'Guadalajara', 'Guadalajara', 1400000),
    (-4, 'ZZ', '02', 'San Pedro Tlaquepaque', 'San Pedro Tlaquepaque', 650000);

  insert into t_results values ('folding drops accents and case',
    public.geo_fold('San Pedro Garza García') = 'san pedro garza garcia' and public.geo_fold('ÑANDÚ') = 'nandu');

  -- 1. Anyone reads places, the careers pages included.
  perform set_config('role', 'anon', true);
  select string_agg(name, ',' order by population desc) into names from public.geo_cities_search('zz', null, 'san pedro');
  insert into t_results values ('a visitor finds cities by the start of the name, biggest first',
    names = 'San Pedro Tlaquepaque,San Pedro Garza García');
  select string_agg(name, ',') into names from public.geo_cities_search('ZZ', '01', 'GARCÍA');
  insert into t_results values ('by any word, accents ignored, inside one state',
    names = 'San Pedro Garza García');
  select string_agg(name || '/' || region_name, ',') into names from public.geo_cities_search('ZZ', null, null, 2);
  insert into t_results values ('no text lists the biggest, with their state, up to the limit',
    names = 'Guadalajara/Jalisco,Monterrey/Nuevo León');
  select count(*) into n from public.geo_cities_search('ZZ', null, 'ter', 999);
  insert into t_results values ('the middle of a word is not a match', n = 0);
  select count(*) into n from public.geo_regions where country_code = 'ZZ';
  insert into t_results values ('a visitor reads states and provinces', n = 2);
  begin
    insert into public.geo_cities (id, country_code, name) values (-9, 'ZZ', 'Mine');
    insert into t_results values ('a visitor can''t add a city', false);
  exception when insufficient_privilege then
    insert into t_results values ('a visitor can''t add a city', true);
  end;

  -- 2. Nor can a signed-in member change places.
  perform set_config('request.jwt.claims', json_build_object('sub', mate, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    update public.geo_regions set name = 'X' where country_code = 'ZZ';
    insert into t_results values ('a member can''t change a state', false);
  exception when insufficient_privilege then
    insert into t_results values ('a member can''t change a state', true);
  end;

  -- 3. The person adds their own shipping address; blanks become null.
  insert into public.os_person_shipping (tenant_id, user_id, recipient_name, line1, line2, city, region, postal_code, country_code, phone)
  values (ten, mate, ' Maya Ruiz ', 'Av. Vasconcelos 150', '  ', 'San Pedro Garza García', 'Nuevo León', ' 66220 ', 'mx', '+52 81 1234 5678');
  select * into row_ from public.os_person_shipping where tenant_id = ten and user_id = mate;
  insert into t_results values ('the person adds their own address, tidied',
    row_.recipient_name = 'Maya Ruiz' and row_.line2 is null and row_.postal_code = '66220' and row_.country_code = 'MX');
  update public.os_person_shipping set notes = 'Leave it with the doorman' where tenant_id = ten and user_id = mate;
  get diagnostics n = row_count;
  insert into t_results values ('and edits it', n = 1);
  begin
    update public.os_person_shipping set phone = 'call me' where tenant_id = ten and user_id = mate;
    insert into t_results values ('a malformed phone is refused', false);
  exception when check_violation then
    insert into t_results values ('a malformed phone is refused', true);
  end;

  -- 4. Another member neither sees nor changes it.
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  select count(*) into n from public.os_person_shipping where user_id = mate;
  insert into t_results values ('another member can''t read it', n = 0);
  update public.os_person_shipping set city = 'Elsewhere' where tenant_id = ten and user_id = mate;
  get diagnostics n = row_count;
  insert into t_results values ('another member can''t change it', n = 0);
  begin
    insert into public.os_person_shipping (tenant_id, user_id, city) values (ten, allan, 'Elsewhere');
    insert into t_results values ('another member can''t add one for someone else', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('another member can''t add one for someone else', st in ('42501', '23505'));
  end;

  -- 5. An admin reads and edits everyone's; the history names fields, never values.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  update public.os_person_shipping set line1 = 'Av. Vasconcelos 155' where tenant_id = ten and user_id = mate;
  get diagnostics n = row_count;
  insert into t_results values ('an admin edits it', n = 1);
  select count(*) into n from public.os_person_shipping where tenant_id = ten;
  insert into t_results values ('an admin reads everyone''s', n >= 1);
  insert into t_results values ('the history names fields and who, never values',
    exists (select 1 from public.os_audit_log a where a.subject_user_id = mate and a.action = 'person.shipping_updated'
            and a.actor_id = allan and a.detail->'fields' = '["street"]'::jsonb)
    and exists (select 1 from public.os_audit_log a where a.subject_user_id = mate and a.action = 'person.shipping_updated'
            and a.actor_id = mate and a.detail->'fields' ? 'country')
    and not exists (select 1 from public.os_audit_log a where a.subject_user_id = mate and a.action = 'person.shipping_updated'
            and (a.detail::text like '%Vasconcelos%' or a.detail::text like '%66220%' or a.detail::text like '%doorman%')));

  -- 6. Nothing for externals (GEX02).
  begin
    insert into public.os_person_shipping (tenant_id, user_id, city) values (ten, alex, 'Austin');
    insert into t_results values ('no shipping address for an external', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('no shipping address for an external', st = 'GEX02');
  end;
  perform set_config('role', 'postgres', true);

  -- 7. Reading, adding and editing are all anyone gets: nobody removes an address.
  select count(*) into n from pg_class c, aclexplode(c.relacl) a
  where c.oid = 'public.os_person_shipping'::regclass
    and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
    and not (a.grantee = 'authenticated'::regrole and a.privilege_type in ('SELECT', 'INSERT', 'UPDATE'));
  insert into t_results values ('members only read, add and edit addresses; visitors nothing', n = 0);
  select count(*) into n from pg_class c, aclexplode(c.relacl) a
  where c.oid in ('public.geo_regions'::regclass, 'public.geo_cities'::regclass)
    and a.grantee in ('anon'::regrole, 'authenticated'::regrole) and a.privilege_type <> 'SELECT';
  insert into t_results values ('places are read-only for everyone but the server', n = 0);
end $$;

-- Raise the results so the whole run rolls back, wherever it runs.
do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n') into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
