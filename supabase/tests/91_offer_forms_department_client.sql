-- Client and Department on Virgilio's three offer forms: right after the
-- Employment type field, in its section, optional, the rest moved down, and an
-- offer holding them prints names in agreements. Runs inside a block that ends
-- by raising its result, so nothing it writes is kept.
do $t$
declare
  r text := '';
  n int;
  f uuid;
  emp int; cli int; dep int; sec_ok boolean;
  ok_place boolean := true;
  offer uuid; dep_id uuid; dep_name text; cli_id uuid; cli_name text;
  vals jsonb;
begin
  foreach f in array array[
    '5cd4d4c1-a520-4936-9489-11d7758fab91',
    '4b5b513b-e239-4e78-ad92-567a66b18638',
    'c59aa7b0-3578-4683-b6ba-2c4d79a46451'
  ]::uuid[] loop
    select min(display_order) into emp from public.offer_form_fields where form_id = f and field_type = 'employment_type';
    select display_order into cli from public.offer_form_fields where form_id = f and field_type = 'client';
    select display_order into dep from public.offer_form_fields where form_id = f and field_type = 'department';
    select (select section_key from public.offer_form_fields where form_id = f and field_type = 'client')
           = (select section_key from public.offer_form_fields where form_id = f and field_type = 'employment_type' order by display_order limit 1)
      into sec_ok;
    ok_place := ok_place and cli = emp + 1 and dep = emp + 2 and coalesce(sec_ok, false);
  end loop;
  r := 'placed_after_employment_type=' || ok_place;

  select count(*) into n from public.offer_form_fields
  where field_type in ('client', 'department') and form_id in ('5cd4d4c1-a520-4936-9489-11d7758fab91','4b5b513b-e239-4e78-ad92-567a66b18638','c59aa7b0-3578-4683-b6ba-2c4d79a46451');
  r := r || ' six_fields=' || (n = 6);
  select count(*) into n from public.offer_form_fields where field_type in ('client', 'department') and is_required;
  r := r || ' optional=' || (n = 0);
  select count(*) into n from (select form_id, display_order from public.offer_form_fields group by 1, 2 having count(*) > 1) x
  where form_id in ('5cd4d4c1-a520-4936-9489-11d7758fab91','4b5b513b-e239-4e78-ad92-567a66b18638','c59aa7b0-3578-4683-b6ba-2c4d79a46451');
  r := r || ' no_two_fields_share_a_place=' || (n = 0);
  select count(*) into n from public.offer_form_fields fi join public.offer_forms fo on fo.id = fi.form_id
  where fi.field_type in ('client', 'department') and fo.tenant_id is not null;
  r := r || ' other_workspaces_untouched=' || (n = 0);

  -- An offer that holds both prints their names.
  select d.id, d.name into dep_id, dep_name from public.departments d
  where d.tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab' and not d.is_archived order by d.name limit 1;
  select o.id, o.name into cli_id, cli_name from public.organizations o
  where o.tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab' and o.org_kind = 'client' and o.is_internal limit 1;
  select ol.id into offer from public.offer_letters ol where ol.form_id = '5cd4d4c1-a520-4936-9489-11d7758fab91' limit 1;
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  update public.offer_letters
     set field_values = coalesce(field_values, '{}') || jsonb_build_object('client', cli_id::text, 'department', dep_id::text)
   where id = offer;
  vals := public.sign_offer_values(offer);
  r := r || ' agreement_prints_client=' || ((vals->'values'->>'client') = btrim(cli_name))
         || ' agreement_prints_department=' || ((vals->'values'->>'department') = btrim(dep_name))
         || ' labels=' || ((vals->'labels'->>'client') = 'Client' and (vals->'labels'->>'department') = 'Department');

  raise exception 'RESULT %', r;
end $t$;
