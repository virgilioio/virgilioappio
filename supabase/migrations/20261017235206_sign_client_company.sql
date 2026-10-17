-- Gio Sign: the client company as a template value (2026-10-17, approved by
-- Allan). Candidate templates can print {{client}}: the name of the job's
-- client organization (fed from Gio Sales, or Virgilio for its own jobs), in
-- documents, placed fields and the email. New candidate templates' default
-- subject reads "Your offer from {{client}}" (set in the app).
--   1. sign_record_values adds "client" for offers and candidates, so the
--      send preview, the frozen envelope values, emails and the editor's
--      sample all have it.
--   2. sign_save_template accepts "client" on candidate templates.

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
  v_hire_start date; v_sender text; v_values jsonb; v_label text; v_client text;
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
    -- The job's client: the organization it's for (fed from Gio Sales, or Virgilio's own).
    select j.title, nullif(btrim(o.name), '') into v_job_title, v_client
    from public.jobs j left join public.organizations o on o.id = j.organization_id
    where j.id = v_job and j.tenant_id = v_ten and j.deleted_at is null;
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
      'start', v_start,
      'client', v_client);
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

create or replace function public.sign_save_template(_t jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := (_t->>'id')::uuid;
  v_ten uuid := (_t->>'tenant_id')::uuid;
  v_form uuid := nullif(_t->>'offer_form_id', '')::uuid;
  v_written jsonb := coalesce(_t->'written', '[]'::jsonb);
  v_old_ten uuid;
  v_pages int;
  v_doc_ids uuid[];
  v_written_ids uuid[];
  v_role_ids uuid[];
  v_field_ids uuid[];
  v_bad text;
  v_not_needed text[];
begin
  if v_id is null or v_ten is null then
    raise exception 'The template is missing its id or workspace.' using errcode = 'GSN12';
  end if;
  if not public.sign_is_admin(v_ten) then
    raise exception 'Only admins can save templates.' using errcode = '42501';
  end if;
  select tenant_id into v_old_ten from public.sign_templates where id = v_id;
  if v_old_ten is not null and v_old_ten <> v_ten then
    raise exception 'That template belongs to another workspace.' using errcode = 'GSN05';
  end if;
  if jsonb_typeof(v_written) <> 'array' then
    raise exception 'The written documents aren''t readable.' using errcode = 'GSN12';
  end if;

  -- Checks the editor also makes, so a template can always be sent.
  if jsonb_array_length(coalesce(_t->'docs', '[]')) + jsonb_array_length(v_written) = 0 then
    raise exception 'Add at least one document.' using errcode = 'GSN12';
  end if;
  select string_agg(x->>'name', ', ') into v_bad
  from jsonb_array_elements(coalesce(_t->'docs', '[]')) x
  where coalesce(x->>'storage_path', '') not like v_ten::text || '/templates/%';
  if v_bad is not null then
    raise exception 'These documents weren''t uploaded to this workspace: %', v_bad using errcode = 'GSN12';
  end if;
  select coalesce(sum((x->>'page_count')::int), 0) into v_pages from jsonb_array_elements(coalesce(_t->'docs', '[]')) x;
  if v_pages > 200 then
    raise exception 'A template can hold up to 200 pages.' using errcode = 'GSN12';
  end if;
  if jsonb_array_length(coalesce(_t->'docs', '[]')) + jsonb_array_length(v_written) > 50 then
    raise exception 'A template can hold up to 50 documents.' using errcode = 'GSN12';
  end if;
  select string_agg(coalesce(nullif(btrim(w->>'name'), ''), 'Untitled'), ', ') into v_bad
  from jsonb_array_elements(v_written) w
  where length(btrim(coalesce(w->>'name', ''))) not between 1 and 200
     or jsonb_typeof(w->'content') <> 'object' or not (w->'content' ? 'root');
  if v_bad is not null then
    raise exception 'These written documents need a name and some text: %', v_bad using errcode = 'GSN12';
  end if;
  -- One order across uploaded and written documents.
  if exists (
    select p from (
      select coalesce((x->>'position')::int, (o - 1)::int) as p
      from jsonb_array_elements(coalesce(_t->'docs', '[]')) with ordinality d(x, o)
      union all
      select (w->>'position')::int from jsonb_array_elements(v_written) w
    ) s
    group by p having count(*) > 1 or p is null or p not between 0 and 49
  ) then
    raise exception 'The documents'' order is mixed up. Move one and save again.' using errcode = 'GSN12';
  end if;

  if not exists (select 1 from jsonb_array_elements(coalesce(_t->'roles', '[]')) r where r->>'role' = 'signer') then
    raise exception 'Add at least one signer.' using errcode = 'GSN12';
  end if;
  -- A signing block in written text counts as the signer's signature field,
  -- unless it sits in a conditional section that might not print.
  select string_agg(r->>'label', ', ') into v_bad
  from jsonb_array_elements(_t->'roles') r
  where r->>'role' = 'signer'
    and not exists (
      select 1 from jsonb_array_elements(coalesce(_t->'fields', '[]')) f
      where f->>'rid' = r->>'id' and f->>'type' = 'signature')
    and not exists (
      select 1 from jsonb_array_elements(v_written) w
      cross join lateral public.sign_written_nodes(w->'content') x
      where x.node->>'type' = 'gio-sign' and x.node->>'roleId' = r->>'id' and coalesce(x.node->>'kind', 'signature') = 'signature'
        and not x.conditional);
  if v_bad is not null then
    raise exception '% still needs a signature field.', v_bad using errcode = 'GSN12';
  end if;
  select string_agg(f->>'id', ', ') into v_bad
  from jsonb_array_elements(coalesce(_t->'fields', '[]')) f
  where f->>'type' <> 'data'
    and not exists (select 1 from jsonb_array_elements(_t->'roles') r where r->>'id' = f->>'rid' and r->>'role' <> 'cc');
  if v_bad is not null then
    raise exception 'Some fields belong to a role that isn''t on the template.' using errcode = 'GSN12';
  end if;
  -- Signing blocks: a role that signs, and a kind a signer can fill.
  if exists (
    select 1 from jsonb_array_elements(v_written) w
    cross join lateral public.sign_written_nodes(w->'content') x
    where x.node->>'type' = 'gio-sign'
      and (coalesce(x.node->>'kind', 'signature') not in ('signature', 'initials', 'date', 'name')
           or not exists (select 1 from jsonb_array_elements(_t->'roles') r
                          where r->>'id' = x.node->>'roleId' and r->>'role' <> 'cc'))
  ) then
    raise exception 'A signing block in the text belongs to a role that isn''t on the template.' using errcode = 'GSN12';
  end if;
  -- Signer fields inside the text: a kind a signer fills, for a role that signs.
  if exists (
    select 1 from jsonb_array_elements(v_written) w
    cross join lateral public.sign_written_nodes(w->'content') x
    where x.node->>'type' = 'gio-field'
      and (coalesce(x.node->>'fieldType', '') not in ('initials', 'date', 'name', 'text', 'checkbox')
           or length(coalesce(x.node->>'label', '')) > 200
           or not exists (select 1 from jsonb_array_elements(_t->'roles') r
                          where r->>'id' = x.node->>'roleId' and r->>'role' <> 'cc'))
  ) then
    raise exception 'A signer field in the text belongs to a role that isn''t on the template.' using errcode = 'GSN12';
  end if;
  -- How values print: one of the known formats, on placed values and in the text.
  select string_agg(distinct s.f, ', ') into v_bad
  from (
    select f->>'data_format' as f
    from jsonb_array_elements(coalesce(_t->'fields', '[]')) f
    where f->>'type' = 'data' and coalesce(f->>'data_format', '') <> ''
    union all
    select x.node->>'format'
    from jsonb_array_elements(v_written) w
    cross join lateral public.sign_written_nodes(w->'content') x
    where x.node->>'type' = 'placeholder' and coalesce(x.node->>'format', '') <> ''
  ) s
  where s.f not in ('money_code', 'money_symbol', 'money_words', 'date_long', 'date_numeric', 'date_dmy', 'number', 'number_words');
  if v_bad is not null then
    raise exception 'These value formats aren''t known: %', v_bad using errcode = 'GSN12';
  end if;
  select string_agg(f->>'page', ', ') into v_bad
  from jsonb_array_elements(coalesce(_t->'fields', '[]')) f
  where (f->>'page')::int >= v_pages;
  if v_bad is not null then
    raise exception 'Some fields sit on a page that isn''t in the documents.' using errcode = 'GSN12';
  end if;

  -- An offer form link is for candidate templates, from this workspace.
  if v_form is not null then
    if _t->>'kind' <> 'candidate' then
      raise exception 'Only candidate templates can be linked to an offer form.' using errcode = 'GSN12';
    end if;
    -- A form with no tenant is shared with every workspace (as offer_forms_select reads them).
    if not exists (select 1 from public.offer_forms of where of.id = v_form and (of.tenant_id is null or of.tenant_id = v_ten)) then
      raise exception 'That offer form isn''t in this workspace.' using errcode = 'GSN12';
    end if;
  end if;
  -- Values: the standard ones, plus the linked form's fields, wherever they're used.
  select string_agg(distinct s.k, ', ') into v_bad
  from (
    select f->>'data_key' as k
    from jsonb_array_elements(coalesce(_t->'fields', '[]')) f
    where f->>'type' = 'data'
    union all
    select coalesce(x.node->>'placeholderKey', x.node->>'key')
    from jsonb_array_elements(v_written) w
    cross join lateral public.sign_written_nodes(w->'content') x
    where x.node->>'type' in ('placeholder', 'gio-if')
  ) s
  where coalesce(s.k, '') not in ('today', 'sender')
    and not (_t->>'kind' = 'candidate' and s.k in ('name', 'job', 'salary', 'start', 'client'))
    and not (_t->>'kind' = 'member' and s.k in ('name', 'role', 'email'))
    and not (_t->>'kind' = 'customer' and s.k in ('company', 'contact', 'contact_email', 'deal', 'value', 'currency', 'fee', 'openings', 'start', 'owner'))
    and not (v_form is not null and exists (
      select 1 from public.offer_form_fields ff where ff.form_id = v_form and ff.field_name = s.k));
  if v_bad is not null then
    raise exception 'These fields aren''t on the linked offer form: %', v_bad using errcode = 'GSN12';
  end if;
  -- Where each role's person comes from.
  if exists (select 1 from jsonb_array_elements(_t->'roles') r
             where coalesce(r->>'fill_from', '') not in ('', 'record', 'hiring_manager', 'sender', 'fixed', 'typed')
                or (r->>'fill_from' = 'hiring_manager' and _t->>'kind' <> 'candidate')
                or (r->>'fill_from' = 'record' and _t->>'kind' = 'customer')) then
    raise exception 'A role is filled from somewhere this template type doesn''t have.' using errcode = 'GSN12';
  end if;
  -- "Not needed" offer fields: only fields of the linked form count.
  select coalesce(array_agg(distinct k), '{}') into v_not_needed
  from jsonb_array_elements_text(coalesce(_t->'not_needed', '[]'::jsonb)) k
  where v_form is not null and exists (select 1 from public.offer_form_fields ff where ff.form_id = v_form and ff.field_name = k);

  -- The tick style is for yes/no fields of the linked form.
  select string_agg(distinct f->>'data_key', ', ') into v_bad
  from jsonb_array_elements(coalesce(_t->'fields', '[]')) f
  where f->>'type' = 'data' and f->>'data_style' = 'tick'
    and not (v_form is not null and exists (
      select 1 from public.offer_form_fields ff
      where ff.form_id = v_form and ff.field_name = f->>'data_key' and ff.field_type::text = 'checkbox'));
  if v_bad is not null then
    raise exception 'Only yes/no fields can show a tick: %', v_bad using errcode = 'GSN12';
  end if;

  insert into public.sign_templates as t
    (id, tenant_id, name, description, kind, app, ordered, subject, body, reminder_days, expiry_days, offer_form_id, offer_fields_not_needed, created_by, updated_by)
  values (
    v_id, v_ten, btrim(_t->>'name'), nullif(btrim(coalesce(_t->>'description', '')), ''),
    (_t->>'kind')::public.sign_kind, _t->>'app', coalesce((_t->>'ordered')::boolean, true),
    btrim(coalesce(_t->>'subject', '')), coalesce(_t->>'body', ''),
    coalesce((_t->>'reminder_days')::smallint, 2), coalesce((_t->>'expiry_days')::smallint, 30),
    v_form, v_not_needed, auth.uid(), auth.uid())
  on conflict (id) do update set
    name = excluded.name, description = excluded.description, kind = excluded.kind, app = excluded.app,
    ordered = excluded.ordered, subject = excluded.subject, body = excluded.body,
    reminder_days = excluded.reminder_days, expiry_days = excluded.expiry_days,
    offer_form_id = excluded.offer_form_id, offer_fields_not_needed = excluded.offer_fields_not_needed, updated_by = auth.uid();

  -- Uploaded documents
  insert into public.sign_documents as d
    (id, tenant_id, template_id, position, name, storage_path, page_count, page_sizes, size_bytes, sha256, removed_at)
  select x.id, v_ten, v_id, coalesce(x.position, x.ord - 1)::smallint, x.name, x.storage_path, x.page_count::smallint,
         coalesce(x.page_sizes, '[]'::jsonb), x.size_bytes, x.sha256, null
  from rows from (jsonb_to_recordset(coalesce(_t->'docs', '[]'))
         as (id uuid, name text, storage_path text, page_count int, page_sizes jsonb, size_bytes int, sha256 text, position int))
       with ordinality as x(id, name, storage_path, page_count, page_sizes, size_bytes, sha256, position, ord)
  on conflict (id) do update set
    position = excluded.position, name = excluded.name, storage_path = excluded.storage_path,
    page_count = excluded.page_count, page_sizes = excluded.page_sizes, size_bytes = excluded.size_bytes,
    sha256 = excluded.sha256, removed_at = null;

  -- Written documents
  insert into public.sign_written_docs as w (id, tenant_id, template_id, position, name, content, removed_at)
  select x.id, v_ten, v_id, x.position::smallint, btrim(x.name), x.content, null
  from jsonb_to_recordset(v_written) as x(id uuid, name text, position int, content jsonb)
  on conflict (id) do update set
    position = excluded.position, name = excluded.name, content = excluded.content, removed_at = null;

  -- Roles
  insert into public.sign_recipients as r
    (id, tenant_id, template_id, position, role, label, fixed, name, email, color, fill_from, removed_at)
  select x.id, v_ten, v_id, x.ord::smallint, x.role::public.sign_recipient_role, btrim(x.label),
         coalesce(x.fixed, false),
         case when x.fixed then nullif(btrim(x.name), '') end,
         case when x.fixed then lower(btrim(x.email)) end,
         x.color,
         case when coalesce(x.fixed, false) then 'fixed' else nullif(x.fill_from, '') end,
         null
  from rows from (jsonb_to_recordset(_t->'roles')
         as (id uuid, label text, role text, fixed boolean, name text, email text, color text, fill_from text))
       with ordinality as x(id, label, role, fixed, name, email, color, fill_from, ord)
  on conflict (id) do update set
    position = excluded.position, role = excluded.role, label = excluded.label, fixed = excluded.fixed,
    name = excluded.name, email = excluded.email, color = excluded.color, fill_from = excluded.fill_from, removed_at = null;

  -- Fields
  insert into public.sign_fields as f
    (id, tenant_id, template_id, recipient_id, type, page, x, y, w, h, required, data_key, font_size, data_style, data_format, removed_at)
  select x.id, v_ten, v_id,
         case when x.type = 'data' then null else x.rid end,
         x.type, x.page::smallint,
         round(x.x, 3), round(x.y, 3), round(x.w, 3), round(x.h, 3),
         case when x.type = 'data' then true else coalesce(x.required, true) end,
         case when x.type = 'data' then x.data_key end,
         case when x.type in ('signature', 'initials', 'checkbox') or x.font_size is null then null
              else round(least(greatest(x.font_size, 6), 24) * 2) / 2 end,
         case when x.type = 'data' and x.data_style = 'tick' then 'tick' end,
         case when x.type = 'data' then nullif(x.data_format, '') end,
         null
  from jsonb_to_recordset(coalesce(_t->'fields', '[]'))
       as x(id uuid, type text, rid uuid, page int, x numeric, y numeric, w numeric, h numeric, required boolean, data_key text, font_size numeric, data_style text, data_format text)
  on conflict (id) do update set
    recipient_id = excluded.recipient_id, type = excluded.type, page = excluded.page,
    x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h,
    required = excluded.required, data_key = excluded.data_key, font_size = excluded.font_size,
    data_style = excluded.data_style, data_format = excluded.data_format, removed_at = null;

  -- Soft-remove what the editor took out.
  select coalesce(array_agg((x->>'id')::uuid), '{}') into v_doc_ids from jsonb_array_elements(coalesce(_t->'docs', '[]')) x;
  select coalesce(array_agg((x->>'id')::uuid), '{}') into v_written_ids from jsonb_array_elements(v_written) x;
  select coalesce(array_agg((x->>'id')::uuid), '{}') into v_role_ids from jsonb_array_elements(_t->'roles') x;
  select coalesce(array_agg((x->>'id')::uuid), '{}') into v_field_ids from jsonb_array_elements(coalesce(_t->'fields', '[]')) x;
  update public.sign_fields set removed_at = now()
   where template_id = v_id and removed_at is null and not (id = any(v_field_ids));
  update public.sign_recipients set removed_at = now()
   where template_id = v_id and removed_at is null and not (id = any(v_role_ids));
  update public.sign_documents set removed_at = now()
   where template_id = v_id and removed_at is null and not (id = any(v_doc_ids));
  update public.sign_written_docs set removed_at = now()
   where template_id = v_id and removed_at is null and not (id = any(v_written_ids));

  return v_id;
end;
$$;

revoke all on function public.sign_record_values(sign_source, uuid, uuid) from public, anon, authenticated;
