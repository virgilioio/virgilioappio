-- Offer form sections you can shape (Allan, 2026-10-19)
--
-- The offer composer showed every form as Role & start, Compensation,
-- Benefits & conditions and Additional terms, guessed from each field's name.
-- The form editor couldn't show them, and nothing could be changed. Allan:
-- "We could have default sections, but have the ability to add more if
-- necessary. Fields should also be flexible around that idea. Nothing is
-- hardcoded, and yes, we may have defaults, but even the defaults could be
-- edited or even removed."
--
-- 1. offer_forms.sections: the form's sections, in order, as
--    [{ id, title, columns }] (columns: 1 or 2, how the composer lays out the
--    fields). Every form starts with the four sections the composer showed;
--    each one can be renamed, reordered, given one or two columns, or taken
--    out, and new ones added. An empty list is allowed (one plain list).
-- 2. offer_form_fields.section_key: the section a field sits in. Fields are
--    ordered by section, then display_order. A field added without one goes
--    in the form's last section.
-- 3. When a section is taken out, its fields move to the last section left
--    (or to none when no section is left), so a field is never lost.
-- 4. Existing fields go where the composer showed them, by the same rules it
--    used (first match wins: Role & start, Compensation, Benefits &
--    conditions, else Additional terms), so no offer looks different.

-- ---- 1. Sections on the form --------------------------------------------------------
alter table public.offer_forms
  add column if not exists sections jsonb not null default '[
    {"id": "role", "title": "Role & start", "columns": 2},
    {"id": "compensation", "title": "Compensation", "columns": 1},
    {"id": "benefits", "title": "Benefits & conditions", "columns": 1},
    {"id": "additional", "title": "Additional terms", "columns": 2}
  ]'::jsonb;

comment on column public.offer_forms.sections is
  'The form''s sections in order: [{ id, title, columns (1 or 2) }]. Fields point at them through offer_form_fields.section_key.';

create or replace function public.offer_forms_a_sections_check()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  _s jsonb;
  _ids text[] := '{}';
begin
  if jsonb_typeof(new.sections) <> 'array' then
    raise exception 'An offer form''s sections must be a list.' using errcode = '22023';
  end if;
  if jsonb_array_length(new.sections) > 30 then
    raise exception 'An offer form can have up to 30 sections.' using errcode = '22023';
  end if;
  for _s in select value from jsonb_array_elements(new.sections) loop
    if jsonb_typeof(_s) <> 'object'
       or coalesce(jsonb_typeof(_s->'id'), '') <> 'string' or btrim(_s->>'id') = '' or length(_s->>'id') > 64
       or coalesce(jsonb_typeof(_s->'title'), '') <> 'string' or btrim(_s->>'title') = '' or length(_s->>'title') > 80
       or coalesce(jsonb_typeof(_s->'columns'), '') <> 'number' or (_s->>'columns') not in ('1', '2') then
      raise exception 'Each section needs an id, a title (up to 80 characters) and 1 or 2 columns.' using errcode = '22023';
    end if;
    if (_s->>'id') = any(_ids) then
      raise exception 'Two sections on this form have the same id.' using errcode = '22023';
    end if;
    _ids := _ids || (_s->>'id');
  end loop;
  return new;
end;
$$;

create trigger offer_forms_a_sections_check
  before insert or update of sections on public.offer_forms
  for each row execute function public.offer_forms_a_sections_check();

-- ---- 2. The section a field sits in -----------------------------------------------
alter table public.offer_form_fields
  add column if not exists section_key text;

comment on column public.offer_form_fields.section_key is
  'The id of the section (offer_forms.sections) this field sits in; null when the form has no sections.';

-- The form's last section, or null when it has none.
create or replace function public.offer_form_last_section(_form_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select f.sections->(jsonb_array_length(f.sections) - 1)->>'id'
  from public.offer_forms f
  where f.id = _form_id and jsonb_array_length(f.sections) > 0;
$$;

-- A field always sits in one of its form's sections (when the form has any).
create or replace function public.offer_form_fields_a_section()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.section_key is null or not exists (
    select 1 from public.offer_forms f, jsonb_array_elements(f.sections) s
    where f.id = new.form_id and s->>'id' = new.section_key
  ) then
    new.section_key := public.offer_form_last_section(new.form_id);
  end if;
  return new;
end;
$$;

create trigger offer_form_fields_a_section
  before insert or update of section_key, form_id on public.offer_form_fields
  for each row execute function public.offer_form_fields_a_section();

-- ---- 3. A section taken out hands its fields to the last one left --------------------
create or replace function public.offer_forms_z_sections_moved()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sections is distinct from old.sections then
    update public.offer_form_fields ff
       set section_key = public.offer_form_last_section(new.id)
     where ff.form_id = new.id
       and (ff.section_key is null or not exists (
             select 1 from jsonb_array_elements(new.sections) s where s->>'id' = ff.section_key))
       and ff.section_key is distinct from public.offer_form_last_section(new.id);
  end if;
  return null;
end;
$$;

create trigger offer_forms_z_sections_moved
  after update of sections on public.offer_forms
  for each row execute function public.offer_forms_z_sections_moved();

-- ---- 4. Existing fields go where the composer showed them --------------------------
update public.offer_form_fields ff
   set section_key = case
     when lower(ff.field_name || ' ' || ff.field_label) ~ '(title|role|reports|manager|start date|location|employment|expire)'
          or ff.field_type::text in ('date', 'recruiter', 'employment_type', 'work_location', 'location') then 'role'
     when lower(ff.field_name || ' ' || ff.field_label) ~ '(salary|compensation|currency|pay period|bonus|equity|vesting)'
          or ff.field_type::text = 'salary' then 'compensation'
     when ff.field_type::text = 'checkbox'
          or lower(ff.field_name || ' ' || ff.field_label) ~ '(benefit|pto|stipend|relocation|non-compete|background check)' then 'benefits'
     else 'additional'
   end
 where ff.section_key is null;
