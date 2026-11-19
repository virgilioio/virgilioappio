-- Offer forms: Client and Department on Virgilio's three forms (Allan, Go! 2026-11-18).
--
-- Placed right after each form's Employment type field, in its section, both
-- optional; the fields after them move down two places. The offer composer
-- starts them on the job's own client and department. Offers already made
-- keep their values and pick these up the next time they're edited. A form
-- that already has a field of the kind is left as it is.
--
-- Needs 20261118210000_offer_department_client_types applied first.

do $m$
declare
  f uuid;
  anchor record;
  have_client boolean;
  have_department boolean;
  step int;
begin
  foreach f in array array[
    '5cd4d4c1-a520-4936-9489-11d7758fab91',  -- Standard Offer Form - Sales
    '4b5b513b-e239-4e78-ad92-567a66b18638',  -- Internal Virgilio Member
    'c59aa7b0-3578-4683-b6ba-2c4d79a46451'   -- Independent Contractor - Non-Sales
  ]::uuid[] loop
    select ff.display_order, ff.section_key, ff.organization_id
      into anchor
    from public.offer_form_fields ff
    where ff.form_id = f and ff.field_type = 'employment_type'
    order by ff.display_order, ff.created_at
    limit 1;
    continue when not found;

    select exists (select 1 from public.offer_form_fields where form_id = f and (field_type = 'client' or field_name = 'client')),
           exists (select 1 from public.offer_form_fields where form_id = f and (field_type = 'department' or field_name = 'department'))
      into have_client, have_department;
    step := (case when have_client then 0 else 1 end) + (case when have_department then 0 else 1 end);
    continue when step = 0;

    update public.offer_form_fields
       set display_order = display_order + step
     where form_id = f and display_order > anchor.display_order;

    if not have_client then
      insert into public.offer_form_fields (form_id, field_name, field_label, field_type, is_required, display_order, section_key, organization_id)
      values (f, 'client', 'Client', 'client', false, anchor.display_order + 1, anchor.section_key, anchor.organization_id);
    end if;
    if not have_department then
      insert into public.offer_form_fields (form_id, field_name, field_label, field_type, is_required, display_order, section_key, organization_id)
      values (f, 'department', 'Department', 'department', false, anchor.display_order + step, anchor.section_key, anchor.organization_id);
    end if;
  end loop;
end $m$;
