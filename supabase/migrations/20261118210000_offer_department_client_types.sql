-- Offer forms: Department and Client fields (Allan, Go! 2026-11-18).
--
-- Jobs have a department and a client; offer forms had no way to hold either.
-- Two new field types: Department (the workspace's departments) and Client
-- (Gio Sales' clients and Virgilio itself, the job wizard's list). The offer
-- composer starts both on the job's own. The offer keeps the id, as the
-- Recruiter field does, and agreements print the name.
--
-- The forms get the fields in a second migration: a new value of a type can't
-- be used in the transaction that adds it.

alter type public.field_type add value if not exists 'department';
alter type public.field_type add value if not exists 'client';

create or replace function public.sign_offer_display(_type text, _raw text, _cfg jsonb, _field_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_raw text := btrim(coalesce(_raw, ''));
  v_amount text;
  v_cur text;
  r text;
  v_max text;
begin
  if v_raw = '' then
    return null;
  end if;
  if left(v_raw, 1) in ('{', '[') then
    begin
      v := v_raw::jsonb;
    exception when others then
      v := null;
    end;
  end if;

  if _type = 'salary' or (v is not null and jsonb_typeof(v) = 'object' and v ? 'amount') then
    v_amount := case when v is not null and jsonb_typeof(v) = 'object' then v->>'amount' else v_raw end;
    v_cur := coalesce(
      nullif(btrim(case when v is not null and jsonb_typeof(v) = 'object' then v->>'currency' end), ''),
      nullif(btrim(_cfg->>'currency'), ''));
    r := public.sign_fmt_amount(replace(coalesce(v_amount, ''), ',', ''));
    return case when r is null then null else concat_ws(' ', v_cur, r) end;
  end if;

  if _type = 'location' or (v is not null and jsonb_typeof(v) = 'object' and (v ? 'city' or v ? 'country')) then
    if v is not null and jsonb_typeof(v) = 'object' then
      return nullif(concat_ws(', ', nullif(btrim(v->>'city'), ''), nullif(btrim(v->>'state'), ''), nullif(btrim(v->>'country'), '')), '');
    end if;
    return v_raw;
  end if;

  if _type = 'date' then
    return public.sign_fmt_date(v_raw);
  end if;

  if _type = 'checkbox' then
    return case when lower(v_raw) in ('true', 'yes', '1', 'on') then 'Yes' else 'No' end;
  end if;

  if _type = 'employment_type' then
    -- The one list (supabase/functions/_shared/employmentTypes.ts), and how older rows spelled it.
    return coalesce(jsonb_build_object(
      'full_time', 'Full-time', 'part_time', 'Part-time',
      'contract', 'Contractor', 'contractor', 'Contractor', 'freelance', 'Contractor',
      'vendor', 'External vendor',
      'temporary', 'Temporary', 'internship', 'Internship') ->> lower(v_raw), v_raw);
  end if;

  -- A department or a client is stored by its id (2026-11-18): the agreement prints its name.
  if _type = 'department' then
    if v_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select nullif(btrim(d.name), '') into r from public.departments d where d.id = v_raw::uuid;
    end if;
    return coalesce(r, v_raw);
  end if;

  if _type = 'client' then
    if v_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select nullif(btrim(o.name), '') into r from public.organizations o where o.id = v_raw::uuid;
    end if;
    return coalesce(r, v_raw);
  end if;

  if _type = 'work_location' then
    return coalesce(jsonb_build_object('remote', 'Remote', 'hybrid', 'Hybrid', 'onsite', 'On-site', 'on_site', 'On-site') ->> v_raw, v_raw);
  end if;

  if _type = 'recruiter' then
    if v_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '') into r
      from public.profiles p where p.user_id = v_raw::uuid;
    end if;
    return coalesce(r, v_raw);
  end if;

  if _type = 'select' then
    select o.option_label into r
    from public.offer_field_select_options o
    where o.offer_field_id = _field_id and o.option_value = v_raw
    limit 1;
    return coalesce(r, v_raw);
  end if;

  if _type = 'number' then
    -- 1250 -> 1,250; anything that isn't a plain number stays as typed.
    return public.sign_fmt_amount(replace(v_raw, ',', ''));
  end if;

  if _type in ('url', 'linkedin') then
    return nullif(regexp_replace(regexp_replace(v_raw, '^https?://(www\.)?', '', 'i'), '/+$', ''), '');
  end if;

  if _type = 'phone' then
    return regexp_replace(v_raw, '\s+', ' ', 'g');
  end if;

  if _type = 'score' then
    v_max := coalesce(nullif(btrim(_cfg->>'max'), ''), '5');
    return case when v_raw ~ '^[0-9]+(\.[0-9]+)?$' then v_raw || ' out of ' || v_max else v_raw end;
  end if;

  if _type = 'file' and (v is null or jsonb_typeof(v) <> 'array') then
    -- A storage path: the file's own name, without the upload's number prefix.
    r := regexp_replace(v_raw, '^.*/', '');
    r := regexp_replace(r, '^([0-9]{10,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[-_]', '', 'i');
    return nullif(r, '');
  end if;

  if v is not null and jsonb_typeof(v) = 'array' then
    select nullif(string_agg(coalesce(o.option_label, e.val), ', ' order by e.ord), '') into r
    from jsonb_array_elements_text(v) with ordinality as e(val, ord)
    left join public.offer_field_select_options o on o.offer_field_id = _field_id and o.option_value = e.val;
    return r;
  end if;

  if v is not null and jsonb_typeof(v) = 'object' then
    -- Never print JSON: the plain values, in order.
    select nullif(string_agg(e.value, ', '), '') into r
    from jsonb_each_text(v) e
    where nullif(btrim(e.value), '') is not null and left(btrim(e.value), 1) not in ('{', '[');
    return r;
  end if;

  return v_raw;
end;
$$;

revoke all on function public.sign_offer_display(text, text, jsonb, uuid) from public, anon, authenticated;
