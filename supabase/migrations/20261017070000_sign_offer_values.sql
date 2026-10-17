-- Offer values in agreements (Gio Sign × offers, phase 1, 2026-10-17)
--
-- 1. sign_offer_display(): one value of an offer form as words. Offer forms
--    store some values as JSON text (salary {"amount","currency"}, location
--    {"city","state","country"}); agreements printed that JSON as-is. Same rules
--    as src/lib/offerValues.ts.
-- 2. sign_offer_values(): every value of an offer, keyed by the form field's
--    name, with its label. Templates can use any of them (data_key = field name).
-- 3. sign_record_values(): candidate agreements get every offer value besides
--    the standard name / job / salary / start; salary is formatted properly.
--    It is only for the Sign functions that check access first, so signed-in
--    users can no longer call it directly.
-- 4. sign_send_preview(): returns the values this template uses ("used"), with
--    labels, so the send sheet lists those instead of a fixed four.

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
    return coalesce(jsonb_build_object(
      'full_time', 'Full-time', 'part_time', 'Part-time', 'contract', 'Contract',
      'temporary', 'Temporary', 'internship', 'Internship', 'freelance', 'Freelance') ->> v_raw, v_raw);
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

create or replace function public.sign_offer_values(_offer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o record;
  k text;
  f record;
  v_values jsonb := '{}';
  v_labels jsonb := '{}';
  v_text text;
begin
  select ol.id, ol.form_id, coalesce(ol.field_values, '{}'::jsonb) as fv
    into o
  from public.offer_letters ol where ol.id = _offer_id;
  if o.id is null then
    return jsonb_build_object('values', '{}'::jsonb, 'labels', '{}'::jsonb);
  end if;

  for k in select jsonb_object_keys(o.fv) loop
    -- Only names a template field can use (sign_fields.data_key).
    continue when k !~ '^[a-z][a-z_]{0,39}$';
    select ff.id, ff.field_type::text as field_type, ff.field_label, ff.field_config
      into f
    from public.offer_form_fields ff
    where ff.field_name = k
    order by (ff.form_id is not distinct from o.form_id) desc, ff.created_at desc
    limit 1;

    v_text := case jsonb_typeof(o.fv->k)
      when 'string' then o.fv->>k
      when 'null' then null
      else (o.fv->k)::text
    end;
    v_values := v_values || jsonb_build_object(k, public.sign_offer_display(f.field_type, v_text, f.field_config, f.id));
    v_labels := v_labels || jsonb_build_object(k, coalesce(nullif(btrim(f.field_label), ''), initcap(replace(k, '_', ' '))));
  end loop;

  return jsonb_build_object('values', jsonb_strip_nulls(v_values), 'labels', v_labels);
end;
$$;

revoke all on function public.sign_offer_values(uuid) from public, anon, authenticated;

create or replace function public.sign_record_values(_source_type sign_source, _source_id uuid, _job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ten uuid; v_cand uuid; v_job uuid; v_offer uuid; v_fv jsonb := '{}';
  v_name text; v_email text; v_job_title text; v_salary text; v_start text; v_role text;
  v_hire_start date; v_sender text; v_values jsonb; v_label text;
  v_offer_vals jsonb := '{}'; v_labels jsonb := '{}';
begin
  if _source_type = 'ats_offer' then
    select o.id, o.candidate_id, o.job_id, coalesce(o.field_values, '{}')
      into v_offer, v_cand, v_job, v_fv
    from public.offer_letters o where o.id = _source_id;
    if v_offer is null then
      raise exception 'That offer doesn''t exist.' using errcode = 'GSN10';
    end if;
  elsif _source_type = 'candidate' then
    v_cand := _source_id;
    v_job := _job_id;
    if v_job is null then
      raise exception 'Pick the job this agreement is for.' using errcode = 'GSN10';
    end if;
    -- The latest offer for this candidate and job (if any) supplies its values.
    select o.id, coalesce(o.field_values, '{}') into v_offer, v_fv
    from public.offer_letters o
    where o.candidate_id = v_cand and o.job_id = v_job and coalesce(o.status, '') <> 'declined'
    order by o.updated_at desc nulls last limit 1;
  elsif _source_type = 'member' then
    select m.tenant_id,
           nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
           lower(coalesce(u.email, m.invited_email)),
           b.name
      into v_ten, v_name, v_email, v_role
    from public.members m
    left join public.profiles p on p.user_id = m.user_id
    left join auth.users u on u.id = m.user_id
    left join public.os_person_profile pp on pp.tenant_id = m.tenant_id and pp.user_id = m.user_id
    left join public.os_bundles b on b.id = pp.bundle_id
    where m.id = _source_id;
    if v_ten is null then
      raise exception 'That person isn''t in People & Access.' using errcode = 'GSN10';
    end if;
    v_values := jsonb_build_object('name', v_name, 'role', v_role, 'email', v_email);
    v_label := coalesce(v_name, v_email) || coalesce(' · ' || v_role, '');
  else
    raise exception 'Customer agreements are sent from the deal in Gio Sales.' using errcode = 'GSN11';
  end if;

  if _source_type <> 'member' then
    select c.tenant_id, nullif(btrim(c.candidate_name), ''), lower(nullif(btrim(coalesce(c.email, c.contact_email)), ''))
      into v_ten, v_name, v_email
    from public.candidates c where c.id = v_cand and c.deleted_at is null;
    if v_ten is null then
      raise exception 'That candidate doesn''t exist.' using errcode = 'GSN10';
    end if;
    select j.title into v_job_title from public.jobs j where j.id = v_job and j.tenant_id = v_ten and j.deleted_at is null;
    if v_job_title is null then
      raise exception 'That job isn''t in this workspace.' using errcode = 'GSN10';
    end if;
    select a.hire_start_date into v_hire_start
    from public.job_candidate_associations a where a.candidate_id = v_cand and a.job_id = v_job;
    if not found then
      raise exception 'This candidate isn''t on that job.' using errcode = 'GSN10';
    end if;

    -- Every value on the offer, as words, keyed by its form field name.
    if v_offer is not null then
      select r->'values', r->'labels' into v_offer_vals, v_labels
      from (select public.sign_offer_values(v_offer) as r) x;
    end if;

    v_salary := coalesce(
      v_offer_vals->>'base_salary',
      v_offer_vals->>'gross_monthly_salary',
      public.sign_offer_display('salary', v_fv->>'base_salary', jsonb_build_object('currency', v_fv->>'currency'), null));
    v_start := coalesce(public.sign_fmt_date(v_fv->>'start_date'), public.sign_fmt_date(v_hire_start::text));
    -- Offer values first; the standard keys win on a clash.
    v_values := coalesce(v_offer_vals, '{}'::jsonb) || jsonb_build_object(
      'name', coalesce(nullif(btrim(v_fv->>'candidate_s_full_legal_name'), ''), nullif(btrim(v_fv->>'full_legal_name'), ''), v_name),
      'job', coalesce(nullif(btrim(v_fv->>'job_title'), ''), v_job_title),
      'salary', v_salary,
      'start', v_start);
    v_label := coalesce(v_values->>'name', v_email) || ' · ' || (v_values->>'job');
  end if;

  select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '') into v_sender
  from public.profiles p where p.user_id = auth.uid();
  v_values := v_values || jsonb_build_object(
    'today', to_char(now() at time zone 'America/Mexico_City', 'FMMonth FMDD, YYYY'),
    'sender', coalesce(v_sender, public.sign_my_email()));

  return jsonb_build_object(
    'tenant_id', v_ten,
    'kind', case when _source_type = 'member' then 'member' else 'candidate' end,
    'job_id', v_job, 'candidate_id', v_cand, 'offer_id', v_offer,
    'label', v_label,
    'values', jsonb_strip_nulls(v_values),
    'labels', coalesce(v_labels, '{}'::jsonb),
    'person', jsonb_build_object('name', coalesce(v_values->>'name', v_name), 'email', v_email));
end;
$$;

-- Only the Sign functions that check access first call this.
revoke all on function public.sign_record_values(sign_source, uuid, uuid) from public, anon, authenticated;

create or replace function public.sign_send_preview(_template_id uuid, _source_type sign_source, _source_id uuid, _job_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t public.sign_templates;
  rec jsonb;
  v_missing jsonb;
  v_used jsonb;
  v_roles jsonb;
  v_first uuid;
begin
  select * into t from public.sign_templates where id = _template_id and archived_at is null;
  if t.id is null then
    raise exception 'That template isn''t available.' using errcode = 'GSN10';
  end if;
  rec := public.sign_record_values(_source_type, _source_id, _job_id);
  if (rec->>'tenant_id')::uuid <> t.tenant_id or t.app <> 'ats' or t.kind::text <> rec->>'kind' then
    raise exception 'That template can''t be used here.' using errcode = 'GSN10';
  end if;
  if not public.sign_can_send(t.tenant_id, t.kind, (rec->>'job_id')::uuid) then
    raise exception 'You can''t send agreements for this record.' using errcode = '42501';
  end if;

  -- The values this template fills in, in the order they first appear.
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', u.data_key,
           'label', coalesce(rec->'labels'->>u.data_key, public.sign_tag_label(u.data_key)),
           'value', rec->'values'->>u.data_key) order by u.first_page, u.first_y), '[]')
    into v_used
  from (
    select f.data_key, min(f.page) as first_page, min(f.y) as first_y
    from public.sign_fields f
    where f.template_id = t.id and f.removed_at is null and f.type = 'data'
    group by f.data_key
  ) u;

  select coalesce(jsonb_agg(u->>'label' order by ord), '[]') into v_missing
  from jsonb_array_elements(v_used) with ordinality as x(u, ord)
  where coalesce(u->>'value', '') = '';

  select r.id into v_first from public.sign_recipients r
  where r.template_id = t.id and r.removed_at is null and r.role = 'signer' and not r.fixed
  order by r.position limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'label', r.label, 'role', r.role, 'fixed', r.fixed, 'color', r.color,
    'name', case when r.fixed then r.name when r.id = v_first then rec->'person'->>'name' else '' end,
    'email', case when r.fixed then r.email when r.id = v_first then rec->'person'->>'email' else '' end)
    order by r.position), '[]') into v_roles
  from public.sign_recipients r
  where r.template_id = t.id and r.removed_at is null;

  return jsonb_build_object('label', rec->'label', 'values', rec->'values', 'used', v_used, 'missing', v_missing, 'roles', v_roles,
    'job_id', rec->'job_id', 'candidate_id', rec->'candidate_id', 'offer_id', rec->'offer_id');
end;
$$;
