-- Offer forms' Department and Client fields: agreements print the name, never
-- the id. Runs inside a block that ends by raising its result, so nothing it
-- writes is kept.
do $t$
declare
  r text := '';
  dep_id uuid; dep_name text;
  cli_id uuid; cli_name text;
  n int;
begin
  select d.id, d.name into dep_id, dep_name from public.departments d
  where d.tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab' and not d.is_archived order by d.name limit 1;
  select o.id, o.name into cli_id, cli_name from public.organizations o
  where o.tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab' and o.org_kind = 'client' and o.is_internal limit 1;
  r := 'setup=' || (dep_id is not null and cli_id is not null);

  r := r || ' department_prints_name=' || (public.sign_offer_display('department', dep_id::text, null, null) = btrim(dep_name))
         || ' client_prints_name=' || (public.sign_offer_display('client', cli_id::text, null, null) = btrim(cli_name))
         || ' uppercase_id_too=' || (public.sign_offer_display('client', upper(cli_id::text), null, null) = btrim(cli_name))
         || ' unknown_id_stays=' || (public.sign_offer_display('department', '00000000-0000-4000-8000-000000000000', null, null) = '00000000-0000-4000-8000-000000000000')
         || ' typed_text_stays=' || (public.sign_offer_display('client', 'Acme Corp', null, null) = 'Acme Corp')
         || ' empty_is_nothing=' || (public.sign_offer_display('department', '  ', null, null) is null)
         || ' a_department_id_is_not_a_client=' || (public.sign_offer_display('client', dep_id::text, null, null) = dep_id::text)
         || ' other_types_untouched=' || (public.sign_offer_display('employment_type', 'vendor', null, null) = 'External vendor'
                                          and public.sign_offer_display('recruiter', 'not a uuid', null, null) = 'not a uuid');

  -- The field types themselves (only once the migration is applied).
  select count(*) into n from pg_enum e join pg_type t on t.oid = e.enumtypid
  where t.typname = 'field_type' and e.enumlabel in ('department', 'client');
  r := r || ' field_types_exist=' || (n = 2);

  r := r || ' not_callable_signed_in=' || (not has_function_privilege('authenticated', 'public.sign_offer_display(text, text, jsonb, uuid)', 'execute'))
         || ' not_callable_anon=' || (not has_function_privilege('anon', 'public.sign_offer_display(text, text, jsonb, uuid)', 'execute'));

  raise exception 'RESULT %', r;
end $t$;
