-- Settings › Templates › Offer forms: Duplicate (Allan, Go! 2026-11-18).
--
-- A copy of an offer form is three tables' worth of rows: the form with its
-- sections, its fields, and the options of its select fields. One function
-- makes all of it or none of it. The copy starts inactive, so recruiters don't
-- pick a form that is still being changed, and it isn't linked to any Gio Sign
-- document (those point at the original).
--
-- It runs as the person calling it, so the rules that decide who may add an
-- offer form decide who may copy one (GOF02 otherwise).

create or replace function public.offer_form_duplicate(p_form_id uuid, p_name text default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  src public.offer_forms%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_new uuid;
  v_field uuid;
  f record;
begin
  if auth.uid() is null then
    raise exception 'Sign in to copy an offer form.' using errcode = '42501';
  end if;

  select * into src from public.offer_forms where id = p_form_id;
  if not found then
    raise exception 'That offer form isn''t there any more.' using errcode = 'GOF01';
  end if;

  if v_name = '' then
    v_name := 'Copy of ' || src.name;
  end if;

  begin
    insert into public.offer_forms (name, description, organization_id, tenant_id, source, is_active, sections, created_by)
    values (left(v_name, 120), src.description, src.organization_id, src.tenant_id, src.source, false, src.sections, auth.uid())
    returning id into v_new;
  exception when insufficient_privilege then
    raise exception 'Only workspace admins can copy an offer form.' using errcode = 'GOF02';
  end;

  for f in
    select * from public.offer_form_fields where form_id = p_form_id order by display_order, created_at, id
  loop
    insert into public.offer_form_fields (
      form_id, field_name, field_label, field_type, is_required, display_order,
      placeholder_text, help_text, accepted_file_types, max_file_size_mb,
      organization_id, created_by, field_config, triggers_approval_restart, section_key)
    values (
      v_new, f.field_name, f.field_label, f.field_type, f.is_required, f.display_order,
      f.placeholder_text, f.help_text, f.accepted_file_types, f.max_file_size_mb,
      f.organization_id, auth.uid(), f.field_config, f.triggers_approval_restart, f.section_key)
    returning id into v_field;

    insert into public.offer_field_select_options (offer_field_id, option_value, option_label, display_order)
    select v_field, o.option_value, o.option_label, o.display_order
    from public.offer_field_select_options o
    where o.offer_field_id = f.id;
  end loop;

  return v_new;
end;
$$;

comment on function public.offer_form_duplicate(uuid, text) is
  'Copies an offer form with its sections, fields and select options, all or nothing. The copy is inactive. Runs as the caller: whoever may add an offer form may copy one (GOF01 no such form, GOF02 not allowed).';

revoke all on function public.offer_form_duplicate(uuid, text) from public, anon;
grant execute on function public.offer_form_duplicate(uuid, text) to authenticated;
