-- Employment type: one list. Agreements print the screens' words, a job can be
-- an external vendor's, and the Independent Contractor offer form names its
-- field as the others do. Runs inside a block that ends by raising its result,
-- so nothing it writes is kept.
do $t$
declare
  r text := '';
  jb uuid;
  n int;
begin
  r := 'contract_reads_contractor=' || (public.sign_offer_display('employment_type', 'contract', null, null) = 'Contractor')
    || ' vendor_reads_external_vendor=' || (public.sign_offer_display('employment_type', 'vendor', null, null) = 'External vendor')
    || ' full_time=' || (public.sign_offer_display('employment_type', 'full_time', null, null) = 'Full-time')
    || ' part_time=' || (public.sign_offer_display('employment_type', 'part_time', null, null) = 'Part-time')
    || ' temporary=' || (public.sign_offer_display('employment_type', 'temporary', null, null) = 'Temporary')
    || ' internship=' || (public.sign_offer_display('employment_type', 'internship', null, null) = 'Internship')
    || ' freelance_is_contractor=' || (public.sign_offer_display('employment_type', 'freelance', null, null) = 'Contractor')
    || ' unknown_stays_as_typed=' || (public.sign_offer_display('employment_type', 'Per diem', null, null) = 'Per diem')
    || ' empty_is_nothing=' || (public.sign_offer_display('employment_type', '  ', null, null) is null)
    || ' work_location_untouched=' || (public.sign_offer_display('work_location', 'onsite', null, null) = 'On-site'
                                       and public.sign_offer_display('work_location', 'hybrid', null, null) = 'Hybrid');

  -- No offer form field of this kind is called "Job Type" on a form that has no other.
  select count(*) into n
  from public.offer_form_fields f
  where f.field_type = 'employment_type' and lower(f.field_label) = 'job type'
    and not exists (select 1 from public.offer_form_fields o
                    where o.form_id = f.form_id and o.id <> f.id and o.field_type = 'employment_type');
  r := r || ' no_lone_job_type_field=' || (n = 0);
  select count(*) into n from public.offer_form_fields
  where id = 'b142cf40-bfc9-402f-88e6-33d2f60bccfa' and field_label = 'Employment Type' and field_name = 'job_type';
  r := r || ' contractor_form_renamed_key_kept=' || (n = 1);

  r := r || ' not_callable_signed_in=' || (not has_function_privilege('authenticated', 'public.sign_offer_display(text, text, jsonb, uuid)', 'execute'));

  -- A job can be an external vendor's.
  select id into jb from public.jobs limit 1;
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  update public.jobs set employment_type = 'vendor' where id = jb;
  select count(*) into n from public.jobs where id = jb and employment_type = 'vendor';
  r := r || ' job_can_be_vendor=' || (n = 1);

  raise exception 'RESULT %', r;
end $t$;
