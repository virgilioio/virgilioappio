-- offer_form_duplicate: a whole offer form copied in one go. Runs inside a
-- block that ends by raising its result, so nothing it writes is kept.
do $t$
declare
  adm uuid; src uuid; cp uuid; cp2 uuid; pick uuid; pick_copy uuid;
  r text := '';
  n int; m int; before int; forms_before int;
  a text; b text;
  rec record;
begin
  select m.user_id into adm
  from public.members m join public.profiles p on p.user_id = m.user_id
  where lower(p.email) = 'allan@virgilio.tech' and m.user_status = 'active'
  limit 1;

  -- The form with the most fields, plus a select field with two options so options are copied too.
  select f.form_id into src from public.offer_form_fields f group by f.form_id order by count(*) desc limit 1;
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  insert into public.offer_form_fields (form_id, field_name, field_label, field_type, display_order)
  values (src, 'test_pick', 'Test pick', 'select', 999) returning id into pick;
  insert into public.offer_field_select_options (offer_field_id, option_value, option_label, display_order)
  values (pick, 'a', 'Option A', 1), (pick, 'b', 'Option B', 2);
  select count(*) into before from public.offer_form_fields where form_id = src;
  select count(*) into forms_before from public.offer_forms;
  r := 'setup=' || (adm is not null and src is not null and before > 1);

  -- An admin copies it, as themself (the function runs with the caller's rights).
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'allan@virgilio.tech')::text, true);
  set local role authenticated;
  cp := public.offer_form_duplicate(src, 'Copy of the test form');
  reset role;

  select * into rec from public.offer_forms where id = cp;
  r := r || ' named_as_asked=' || (rec.name = 'Copy of the test form')
         || ' starts_inactive=' || (rec.is_active = false)
         || ' made_by_caller=' || (rec.created_by = adm)
         || ' same_sections_and_workspace=' || (
              rec.sections = (select sections from public.offer_forms where id = src)
              and rec.tenant_id is not distinct from (select tenant_id from public.offer_forms where id = src)
              and rec.description is not distinct from (select description from public.offer_forms where id = src));

  select count(*) into n from public.offer_form_fields where form_id = cp;
  select md5(string_agg(concat_ws('|', field_name, field_label, field_type, is_required, display_order, coalesce(placeholder_text, ''), coalesce(help_text, ''), coalesce(field_config::text, ''), triggers_approval_restart, coalesce(section_key, '')), chr(10) order by display_order, field_name))
    into a from public.offer_form_fields where form_id = src;
  select md5(string_agg(concat_ws('|', field_name, field_label, field_type, is_required, display_order, coalesce(placeholder_text, ''), coalesce(help_text, ''), coalesce(field_config::text, ''), triggers_approval_restart, coalesce(section_key, '')), chr(10) order by display_order, field_name))
    into b from public.offer_form_fields where form_id = cp;
  r := r || ' every_field_copied=' || (n = before and a = b);
  select count(*) into n from public.offer_form_fields c join public.offer_form_fields s on s.id = c.id where c.form_id = cp and s.form_id = src;
  r := r || ' fields_are_new_rows=' || (n = 0);

  select id into pick_copy from public.offer_form_fields where form_id = cp and field_name = 'test_pick';
  select count(*) into n from public.offer_field_select_options where offer_field_id = pick_copy and option_label in ('Option A', 'Option B');
  select count(*) into m from public.offer_field_select_options where offer_field_id = pick;
  r := r || ' select_options_copied=' || (n = 2 and m = 2);

  select count(*) into n from public.offer_form_fields where form_id = src;
  r := r || ' original_untouched=' || (n = before);
  select count(*) into n from public.sign_templates where offer_form_id = cp;
  r := r || ' no_document_linked=' || (n = 0);

  -- No name given: "Copy of" the original's.
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated', 'email', 'allan@virgilio.tech')::text, true);
  set local role authenticated;
  cp2 := public.offer_form_duplicate(src, '   ');
  reset role;
  r := r || ' unnamed_copy_is_copy_of=' || ((select name from public.offer_forms where id = cp2) = 'Copy of ' || (select name from public.offer_forms where id = src));

  -- A form that isn't there.
  begin
    set local role authenticated;
    perform public.offer_form_duplicate(gen_random_uuid(), 'x');
    reset role;
    r := r || ' missing_form_refused=false';
  exception when others then
    reset role;
    r := r || ' missing_form_refused=' || (sqlstate = 'GOF01');
  end;

  -- Someone who can't add offer forms can't copy one, and nothing is left behind.
  select count(*) into forms_before from public.offer_forms;
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  begin
    set local role authenticated;
    perform public.offer_form_duplicate(src, 'Not allowed');
    reset role;
    r := r || ' stranger_refused=false';
  exception when others then
    reset role;
    r := r || ' stranger_refused=' || (sqlstate = 'GOF02');
  end;
  select count(*) into n from public.offer_forms;
  r := r || ' nothing_left_behind=' || (n = forms_before);

  -- Signed out.
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.offer_form_duplicate(src, 'x');
    r := r || ' signed_out_refused=false';
  exception when others then
    r := r || ' signed_out_refused=' || (sqlstate = '42501');
  end;

  r := r || ' anon_cant_call=' || (not has_function_privilege('anon', 'public.offer_form_duplicate(uuid, text)', 'execute'))
         || ' signed_in_can_call=' || has_function_privilege('authenticated', 'public.offer_form_duplicate(uuid, text)', 'execute');

  raise exception 'RESULT %', r;
end $t$;
