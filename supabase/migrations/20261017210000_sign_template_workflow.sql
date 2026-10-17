-- Gio Sign: the New / Edit template workflow, database part (Allan, 2026-10-17)
--
-- 1. Value formats. A placed value (sign_fields.data_format) or a value in
--    written text (the placeholder node's "format") can print in its own
--    format: money as "MXN 480,000 / yearly", "$480,000 MXN per year" or in
--    words with the figure; dates as "October 26, 2026", "26/10/2026" or
--    "26 October 2026"; numbers as a figure or in words with the figure.
--    sign_format() does the formatting, sign_value_variant() finds the raw
--    value for a key, and sign_variants() returns them as "key|format".
--    No format keeps today's wording.
-- 2. Signer fields inside written text: "gio-field" nodes (roleId,
--    fieldType initials/date/name/text/checkbox, required, label).
--    sign_save_template checks them; sign_attach_render turns them into
--    fields with their own required flag and label.
-- 3. A signing block inside a conditional section no longer counts as the
--    signer's signature (it might not print). Closes known gap (1).
-- 4. sign_send freezes formatted values (on placed fields and as "key|format"
--    in the snapshot); sign_send_preview returns them too.
-- 5. sign_sample_values(form, uses): the template editor's Preview with the
--    latest real offer on that form. Admins only.

alter table public.sign_fields add column data_format text;
alter table public.sign_fields add constraint sign_fields_data_format_check
  check (data_format is null or (type = 'data' and data_format in ('money_code', 'money_symbol', 'money_words', 'date_long', 'date_numeric', 'date_dmy', 'number', 'number_words')));

-- ---- 1. Formats --------------------------------------------------------------
create or replace function public.sign_num_words(_n bigint)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  ones text[] := array['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  tens text[] := array['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  scales text[] := array['', ' thousand', ' million', ' billion', ' trillion'];
  n bigint := _n;
  parts text[] := '{}';
  chunk int;
  i int := 1;
  w text;
begin
  if n is null then
    return null;
  end if;
  if n < 0 then
    return 'minus ' || public.sign_num_words(-n);
  end if;
  if n = 0 then
    return 'zero';
  end if;
  if n >= 1000000000000000 then
    return null;
  end if;
  while n > 0 loop
    chunk := (n % 1000)::int;
    if chunk > 0 then
      w := '';
      if chunk >= 100 then
        w := ones[chunk / 100 + 1] || ' hundred';
      end if;
      if chunk % 100 > 0 then
        if w <> '' then
          w := w || ' ';
        end if;
        if chunk % 100 < 20 then
          w := w || ones[chunk % 100 + 1];
        else
          w := w || tens[(chunk % 100) / 10 + 1] || case when chunk % 10 > 0 then '-' || ones[chunk % 10 + 1] else '' end;
        end if;
      end if;
      parts := array_prepend(w || scales[i], parts);
    end if;
    n := n / 1000;
    i := i + 1;
  end loop;
  return array_to_string(parts, ' ');
end;
$$;

-- A raw value in one of the formats; null when the format doesn't fit it.
create or replace function public.sign_format(_type text, _raw text, _cfg jsonb, _format text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v jsonb;
  v_amount numeric;
  v_cur text;
  v_fig text;
  v_period text;
  v_per text;
  v_every text;
  d date;
  n numeric;
begin
  if _raw is null or btrim(_raw) = '' or _format is null then
    return null;
  end if;

  if _format like 'money!_%' escape '!' then
    if left(btrim(_raw), 1) = '{' then
      begin
        v := btrim(_raw)::jsonb;
      exception when others then
        v := null;
      end;
    end if;
    v_cur := upper(coalesce(nullif(btrim(v->>'currency'), ''), nullif(btrim(_cfg->>'currency'), '')));
    begin
      v_amount := replace(btrim(coalesce(v->>'amount', _raw)), ',', '')::numeric;
    exception when others then
      return null;
    end;
    v_fig := public.sign_fmt_amount(v_amount::text);
    v_period := lower(coalesce(_cfg->>'period', ''));
    v_per := case v_period when 'annually' then 'yearly' when 'yearly' then 'yearly' when 'monthly' then 'monthly'
      when 'weekly' then 'weekly' when 'biweekly' then 'biweekly' when 'daily' then 'daily' when 'hourly' then 'hourly' end;
    v_every := case v_period when 'annually' then 'per year' when 'yearly' then 'per year' when 'monthly' then 'per month'
      when 'weekly' then 'per week' when 'biweekly' then 'every two weeks' when 'daily' then 'per day' when 'hourly' then 'per hour' end;
    if _format = 'money_code' then
      return concat_ws(' ', v_cur, v_fig) || coalesce(' / ' || v_per, '');
    elsif _format = 'money_symbol' then
      return coalesce(jsonb_build_object('USD', '$', 'MXN', '$', 'CAD', '$', 'COP', '$', 'ARS', '$', 'CLP', '$',
               'EUR', '€', 'GBP', '£', 'BRL', 'R$', 'PEN', 'S/') ->> v_cur, '')
             || v_fig || coalesce(' ' || v_cur, '') || coalesce(' ' || v_every, '');
    elsif _format = 'money_words' then
      return public.sign_num_words(trunc(v_amount)::bigint)
             || coalesce(' ' || coalesce(jsonb_build_object('USD', 'US dollars', 'MXN', 'Mexican pesos', 'CAD', 'Canadian dollars',
                  'EUR', 'euros', 'GBP', 'British pounds', 'COP', 'Colombian pesos', 'ARS', 'Argentine pesos',
                  'CLP', 'Chilean pesos', 'BRL', 'Brazilian reais', 'PEN', 'Peruvian soles') ->> v_cur, v_cur), '')
             || ' (' || concat_ws(' ', v_cur, v_fig) || ')' || coalesce(' ' || v_every, '');
    end if;
    return null;
  end if;

  if _format like 'date!_%' escape '!' then
    begin
      d := left(btrim(_raw), 10)::date;
    exception when others then
      return null;
    end;
    return case _format
      when 'date_long' then to_char(d, 'FMMonth FMDD, YYYY')
      when 'date_numeric' then to_char(d, 'DD/MM/YYYY')
      when 'date_dmy' then to_char(d, 'FMDD FMMonth YYYY')
    end;
  end if;

  if _format in ('number', 'number_words') then
    begin
      n := replace(btrim(_raw), ',', '')::numeric;
    exception when others then
      return null;
    end;
    if _format = 'number' or n <> trunc(n) or n < 0 then
      return public.sign_fmt_amount(n::text);
    end if;
    return public.sign_num_words(n::bigint) || ' (' || public.sign_fmt_amount(n::text) || ')';
  end if;
  return null;
end;
$$;

-- The value of _key for a record (sign_record_values) in _format.
create or replace function public.sign_value_variant(_rec jsonb, _key text, _format text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_offer uuid := nullif(_rec->>'offer_id', '')::uuid;
  fv jsonb := '{}';
  v_form uuid;
  k text := _key;
  v_raw text;
  v_type text;
  v_cfg jsonb;
begin
  if v_offer is not null then
    select coalesce(ol.field_values, '{}'::jsonb), ol.form_id into fv, v_form
    from public.offer_letters ol where ol.id = v_offer;
  end if;
  if _key = 'today' then
    v_type := 'date';
    v_raw := to_char(now() at time zone 'America/Mexico_City', 'YYYY-MM-DD');
  elsif _key = 'start' then
    v_type := 'date';
    v_raw := nullif(btrim(fv->>'start_date'), '');
    if v_raw is null and coalesce(_rec->'values'->>'start', '') ~ '^[A-Z][a-z]+ [0-9]{1,2}, [0-9]{4}$' then
      begin
        v_raw := to_char(to_date(_rec->'values'->>'start', 'FMMonth FMDD, YYYY'), 'YYYY-MM-DD');
      exception when others then
        v_raw := null;
      end;
    end if;
  else
    if _key = 'salary' then
      k := case when nullif(fv->>'base_salary', '') is not null then 'base_salary' else 'gross_monthly_salary' end;
    end if;
    v_raw := case jsonb_typeof(fv->k) when 'string' then fv->>k when 'null' then null else (fv->k)::text end;
    select ff.field_type::text, ff.field_config into v_type, v_cfg
    from public.offer_form_fields ff
    where ff.field_name = k
    order by (ff.form_id is not distinct from v_form) desc, ff.created_at desc
    limit 1;
    if _key = 'salary' then
      v_type := 'salary';
    end if;
  end if;
  return public.sign_format(v_type, v_raw, v_cfg, _format);
end;
$$;

-- Every [key, format] pair a template prints in its own format.
create or replace function public.sign_template_uses(_template_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_array(u.k, u.f)), '[]'::jsonb)
  from (
    select distinct f.data_key as k, f.data_format as f
    from public.sign_fields f
    where f.template_id = _template_id and f.removed_at is null and f.type = 'data' and f.data_format is not null
    union
    select distinct x.node->>'placeholderKey', x.node->>'format'
    from public.sign_written_docs w
    cross join lateral public.sign_written_nodes(w.content) x
    where w.template_id = _template_id and w.removed_at is null
      and x.node->>'type' = 'placeholder' and coalesce(x.node->>'format', '') <> ''
  ) u
  where u.k is not null;
$$;

-- { "key|format": value } for a record and a list of [key, format] pairs.
create or replace function public.sign_variants(_rec jsonb, _uses jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg((e.u->>0) || '|' || (e.u->>1), z.v), '{}'::jsonb)
  from (select value as u from jsonb_array_elements(coalesce(_uses, '[]'::jsonb)) limit 200) e
  cross join lateral (select public.sign_value_variant(_rec, e.u->>0, e.u->>1) as v) z
  where jsonb_typeof(e.u) = 'array' and z.v is not null
    and e.u->>1 in ('money_code', 'money_symbol', 'money_words', 'date_long', 'date_numeric', 'date_dmy', 'number', 'number_words');
$$;

-- ---- 2. Saving, previewing and sending ------------------------------------------
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
    and not (_t->>'kind' = 'candidate' and s.k in ('name', 'job', 'salary', 'start'))
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
  v_blank jsonb;
  v_used jsonb;
  v_roles jsonb;
  v_first uuid;
  v_gate jsonb := null;
  v_form uuid;
  v_optional text[];
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
  if _source_type = 'ats_offer' then
    v_gate := public.offer_can_send(_source_id);
    select ol.form_id into v_form from public.offer_letters ol where ol.id = _source_id;
    if t.offer_form_id is not null and t.offer_form_id is distinct from v_form then
      raise exception 'This template is for a different offer form.' using errcode = 'GSN16';
    end if;
  elsif t.offer_form_id is not null then
    raise exception 'This template fills in an offer. Send it from the offer.' using errcode = 'GSN16';
  end if;
  v_optional := public.sign_optional_keys(t.id, coalesce(t.offer_form_id, v_form));

  -- The values this template fills in: placed ones in page order, then written ones.
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', k.key,
           'label', coalesce(rec->'labels'->>k.key, public.sign_tag_label(k.key)),
           'value', rec->'values'->>k.key,
           'optional', k.key = any(v_optional)) order by o.first_page nulls last, o.first_y nulls last, k.key), '[]')
    into v_used
  from public.sign_template_keys(t.id) k
  left join (
    select f.data_key, min(f.page) as first_page, min(f.y) as first_y
    from public.sign_fields f
    where f.template_id = t.id and f.removed_at is null and f.type = 'data'
    group by f.data_key
  ) o on o.data_key = k.key;

  select coalesce(jsonb_agg(u->>'label' order by ord) filter (where not (u->>'optional')::boolean), '[]'),
         coalesce(jsonb_agg(u->>'label' order by ord) filter (where (u->>'optional')::boolean), '[]')
    into v_missing, v_blank
  from jsonb_array_elements(v_used) with ordinality as x(u, ord)
  where coalesce(u->>'value', '') = '';

  select r.id into v_first from public.sign_recipients r
  where r.template_id = t.id and r.removed_at is null and r.role = 'signer' and not r.fixed
  order by r.position limit 1;

  -- Who each role is: from the record, the job, the sender, a fixed person,
  -- or typed when sending (older templates, roles with no source).
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'label', r.label, 'role', r.role, 'fixed', r.fixed, 'color', r.color,
    'source', p->>'source', 'locked', (p->>'source') <> 'typed',
    'name', coalesce(p->>'name', ''), 'email', coalesce(p->>'email', ''))
    order by r.position), '[]') into v_roles
  from public.sign_recipients r
  cross join lateral (select public.sign_role_person(r, rec, v_first) as p) x
  where r.template_id = t.id and r.removed_at is null;

  -- Values with a format of their own are added as "key|format".
  return jsonb_build_object('label', rec->'label',
    'values', (rec->'values') || public.sign_variants(rec, public.sign_template_uses(t.id)), 'used', v_used,
    'missing', v_missing, 'blank', v_blank, 'roles', v_roles,
    'job_id', rec->'job_id', 'candidate_id', rec->'candidate_id', 'offer_id', rec->'offer_id',
    'gate', v_gate);
end;
$$;

create or replace function public.sign_send(_template_id uuid, _source_type sign_source, _source_id uuid, _job_id uuid, _people jsonb, _send_at timestamp with time zone default null, _subject text default null, _body text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.sign_templates;
  rec jsonb;
  v_values jsonb;
  v_missing text;
  v_env uuid;
  v_sender text;
  v_sender_first text;
  v_company text;
  v_snapshot jsonb;
  v_variants jsonb;
  v_email text := public.sign_my_email();
  v_job uuid;
  v_cand uuid;
  v_offer uuid;
  v_gate jsonb;
  v_form uuid;
  v_optional text[];
  v_n int;
  v_dup text;
  r record;
  v_map jsonb := '{}';
  v_new uuid;
  v_name text;
  v_addr text;
  v_first uuid;
  v_who jsonb;
  rp public.sign_recipients;
begin
  select * into t from public.sign_templates where id = _template_id and archived_at is null for update;
  if t.id is null then
    raise exception 'That template isn''t available.' using errcode = 'GSN10';
  end if;
  rec := public.sign_record_values(_source_type, _source_id, _job_id);
  v_job := (rec->>'job_id')::uuid;
  v_cand := (rec->>'candidate_id')::uuid;
  v_offer := (rec->>'offer_id')::uuid;
  if (rec->>'tenant_id')::uuid <> t.tenant_id or t.app <> 'ats' or t.kind::text <> rec->>'kind' then
    raise exception 'That template can''t be used here.' using errcode = 'GSN10';
  end if;
  if not public.sign_can_send(t.tenant_id, t.kind, v_job) then
    raise exception 'You can''t send agreements for this record.' using errcode = '42501';
  end if;
  if _source_type = 'ats_offer' then
    -- Locks the offer so two sends can't both pass the gate.
    perform 1 from public.offer_letters where id = _source_id for update;
    v_gate := public.offer_can_send(_source_id);
    if not (v_gate->>'ok')::boolean then
      raise exception '%', public.offer_send_refusal(v_gate->>'reason') using errcode = 'GSN15';
    end if;
    select ol.form_id into v_form from public.offer_letters ol where ol.id = _source_id;
    if t.offer_form_id is not null and t.offer_form_id is distinct from v_form then
      raise exception 'This template is for a different offer form.' using errcode = 'GSN16';
    end if;
  else
    if t.offer_form_id is not null then
      raise exception 'This template fills in an offer. Send it from the offer.' using errcode = 'GSN16';
    end if;
    -- Another agreement (NDA, policy...): not tied to the offer's lifecycle.
    v_offer := null;
  end if;
  if _send_at is not null and _send_at <= now() + interval '1 minute' then
    raise exception 'Pick a date and time in the future.' using errcode = 'GSN08';
  end if;
  if _subject is not null and (length(btrim(_subject)) = 0 or length(_subject) > 200) then
    raise exception 'The subject needs 1 to 200 characters.' using errcode = 'GSN13';
  end if;
  if _body is not null and length(_body) > 5000 then
    raise exception 'The message can be up to 5,000 characters.' using errcode = 'GSN13';
  end if;

  -- Every value the template needs, placed or written (conditional ones and
  -- optional offer fields may be empty).
  v_values := rec->'values';
  v_optional := public.sign_optional_keys(t.id, coalesce(t.offer_form_id, v_form));
  select string_agg(distinct coalesce(rec->'labels'->>k.key, public.sign_tag_label(k.key)), ', ') into v_missing
  from public.sign_template_keys(t.id) k
  where coalesce(v_values->>k.key, '') = ''
    and not (k.key = any(v_optional));
  if v_missing is not null then
    raise exception 'Missing from the record: %. Add it there first.', v_missing using errcode = 'GSN14';
  end if;

  -- Every role needs a person; nobody signs twice. Roles with a source are
  -- filled here (the sender can't change them); the rest come from _people.
  select tr.id into v_first from public.sign_recipients tr
  where tr.template_id = t.id and tr.removed_at is null and tr.role = 'signer' and not tr.fixed
  order by tr.position limit 1;
  for rp in
    select tr.* from public.sign_recipients tr
    where tr.template_id = t.id and tr.removed_at is null order by tr.position
  loop
    v_who := public.sign_role_person(rp, rec, v_first);
    if v_who->>'source' = 'typed' then
      select nullif(btrim(p->>'name'), ''), lower(nullif(btrim(p->>'email'), ''))
        into v_name, v_addr
      from jsonb_array_elements(coalesce(_people, '[]')) p
      where (p->>'role_id')::uuid = rp.id;
    else
      v_name := nullif(btrim(v_who->>'name'), '');
      v_addr := lower(nullif(btrim(v_who->>'email'), ''));
      if v_addr is null and v_who->>'source' = 'hiring_manager' then
        raise exception '% comes from the job, and this job has no hiring manager. Add one to the job''s team first.', rp.label using errcode = 'GSN13';
      end if;
    end if;
    if v_name is null or v_addr is null or v_addr !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_name) > 120 then
      raise exception '% needs a name and a valid email.', rp.label using errcode = 'GSN13';
    end if;
    v_map := v_map || jsonb_build_object(rp.id::text, jsonb_build_object('name', v_name, 'email', v_addr));
  end loop;
  select string_agg(e, ', ') into v_dup from (
    select v->>'email' e from jsonb_each(v_map) x(k, v)
    join public.sign_recipients tr on tr.id = x.k::uuid and tr.role <> 'cc'
    group by 1 having count(*) > 1) d;
  if v_dup is not null then
    raise exception '% is on more than one signing role.', v_dup using errcode = 'GSN13';
  end if;

  select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), nullif(btrim(p.first_name), '')
    into v_sender, v_sender_first
  from public.profiles p where p.user_id = auth.uid();
  select nullif(btrim(tn.name), '') into v_company from public.tenants tn where tn.id = t.tenant_id;
  -- Values only the email uses (the documents can't).
  v_snapshot := v_values || jsonb_strip_nulls(jsonb_build_object(
    'first_name', nullif(split_part(btrim(coalesce(v_values->>'name', '')), ' ', 1), ''),
    'company', v_company,
    'sender_first', coalesce(v_sender_first, split_part(coalesce(v_sender, v_email, ''), ' ', 1))));
  -- Values with a format of their own, saved as "key|format" for the written text.
  v_variants := public.sign_variants(rec, public.sign_template_uses(t.id));
  v_snapshot := v_snapshot || v_variants;

  perform set_config('gio.sign_rpc', 'on', true);

  insert into public.sign_envelopes (
    tenant_id, title, kind, status, template_id, source_type, source_id, source_label,
    ats_job_id, ats_candidate_id, ordered, subject, body, reminder_days, expiry_days, data_snapshot,
    origin, sender_user_id, sender_name, sender_email, scheduled_at, dispatch_at, created_by,
    offer_id, offer_fingerprint)
  values (
    t.tenant_id,
    left(t.name || ' · ' || coalesce(v_values->>'name', rec->>'label'), 200),
    t.kind,
    case when _send_at is null then 'queued' else 'scheduled' end::public.sign_status,
    t.id, _source_type, _source_id, rec->>'label',
    v_job, v_cand, t.ordered,
    coalesce(btrim(_subject), t.subject), coalesce(_body, t.body), t.reminder_days, t.expiry_days, v_snapshot,
    'ats', auth.uid(), coalesce(v_sender, v_email), v_email,
    _send_at, case when _send_at is null then now() + interval '5 seconds' end, auth.uid(),
    v_offer, case when v_offer is null then null else public.sign_offer_fingerprint(v_offer, t.id) end)
  returning id into v_env;

  -- Documents: the same stored files (template files are never replaced).
  insert into public.sign_documents (tenant_id, envelope_id, position, name, storage_path, page_count, page_sizes, size_bytes, sha256)
  select t.tenant_id, v_env, d.position, d.name, d.storage_path, d.page_count, d.page_sizes, d.size_bytes, d.sha256
  from public.sign_documents d
  where d.template_id = t.id and d.removed_at is null;

  -- Written documents: frozen copies, rendered to a PDF before anyone is invited.
  insert into public.sign_written_docs (tenant_id, envelope_id, position, name, content)
  select t.tenant_id, v_env, w.position, w.name, w.content
  from public.sign_written_docs w
  where w.template_id = t.id and w.removed_at is null;

  -- People, in the template's order.
  for r in
    select tr.* from public.sign_recipients tr
    where tr.template_id = t.id and tr.removed_at is null order by tr.position
  loop
    insert into public.sign_recipients (tenant_id, envelope_id, template_role_id, position, role, label, name, email, color, user_id)
    values (t.tenant_id, v_env, r.id, r.position, r.role, r.label,
            v_map->r.id::text->>'name', v_map->r.id::text->>'email', r.color,
            (select m.user_id from public.members m join auth.users u on u.id = m.user_id
              where m.tenant_id = t.tenant_id and m.user_status = 'active'
                and lower(u.email) = v_map->r.id::text->>'email' limit 1))
    returning id into v_new;
    v_map := jsonb_set(v_map, array[r.id::text, 'new'], to_jsonb(v_new));
  end loop;

  -- Fields; data fields carry their frozen value, in their own format if they
  -- have one (null when optional and empty).
  insert into public.sign_fields (tenant_id, envelope_id, recipient_id, type, page, x, y, w, h, required, data_key, font_size, data_style, data_format, label, value, filled_at)
  select t.tenant_id, v_env,
         case when f.recipient_id is null then null else (v_map->f.recipient_id::text->>'new')::uuid end,
         f.type, f.page, f.x, f.y, f.w, f.h, f.required, f.data_key, f.font_size, f.data_style, f.data_format, f.label,
         case when f.type = 'data' then nullif(coalesce(v_variants->>(f.data_key || '|' || f.data_format), v_values->>f.data_key), '') end,
         case when f.type = 'data' then now() end
  from public.sign_fields f
  where f.template_id = t.id and f.removed_at is null;

  perform public.sign_log(v_env, 'created', 'Created from ' || t.name);
  select count(*) into v_n from public.sign_recipients where envelope_id = v_env and role <> 'cc';
  if _send_at is null then
    perform public.sign_log(v_env, 'queued', 'Sending to ' || v_n || case when v_n = 1 then ' person' else ' people' end, true);
  else
    perform public.sign_log(v_env, 'scheduled',
      'Scheduled for ' || to_char(_send_at at time zone 'America/Mexico_City', 'Mon DD, HH24:MI'), true);
  end if;

  perform set_config('gio.sign_count', 'on', true);
  update public.sign_templates set uses = uses + 1 where id = t.id;
  perform set_config('gio.sign_count', '', true);

  return v_env;
end;
$$;

-- ---- 3. Signer fields from written text become fields --------------------------
create or replace function public.sign_attach_render(
  _written_id uuid, _storage_path text, _page_count int, _page_sizes jsonb, _size_bytes int, _sha256 text, _blocks jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.sign_written_docs;
  v_before int;
  v_doc uuid;
  b jsonb;
  v_rid uuid;
begin
  select * into w from public.sign_written_docs where id = _written_id and envelope_id is not null and removed_at is null for update;
  if w.id is null then
    raise exception 'That written document isn''t on an envelope.' using errcode = 'GSN10';
  end if;
  if w.rendered_document_id is not null then
    return w.rendered_document_id;
  end if;
  if not exists (select 1 from public.sign_envelopes e
                 where e.id = w.envelope_id and e.deleted_at is null and e.status in ('queued', 'scheduled')) then
    raise exception 'That envelope is no longer waiting to go out.' using errcode = 'GSN03';
  end if;
  if exists (select 1 from public.sign_written_docs x
             where x.envelope_id = w.envelope_id and x.removed_at is null and x.rendered_document_id is null
               and x.position < w.position) then
    raise exception 'Render the earlier written documents first.' using errcode = 'GSN12';
  end if;
  if _page_count is null or _page_count not between 1 and 200 or jsonb_typeof(_page_sizes) <> 'array'
     or jsonb_array_length(_page_sizes) <> _page_count
     or _storage_path not like w.tenant_id::text || '/envelopes/' || w.envelope_id::text || '/%' then
    raise exception 'The rendered PDF isn''t usable.' using errcode = 'GSN12';
  end if;

  perform set_config('gio.sign_rpc', 'on', true);
  select coalesce(sum(d.page_count), 0) into v_before
  from public.sign_documents d
  where d.envelope_id = w.envelope_id and d.removed_at is null and d.position < w.position;

  update public.sign_fields
     set page = page + _page_count
   where envelope_id = w.envelope_id and removed_at is null and page >= v_before;

  insert into public.sign_documents (tenant_id, envelope_id, position, name, storage_path, page_count, page_sizes, size_bytes, sha256)
  values (w.tenant_id, w.envelope_id, w.position, w.name, _storage_path, _page_count, _page_sizes, _size_bytes, _sha256)
  returning id into v_doc;

  -- Signing blocks and signer fields: each has a role, a kind and where it landed.
  for b in select value from jsonb_array_elements(coalesce(_blocks, '[]'::jsonb)) loop
    select r.id into v_rid
    from public.sign_recipients r
    where r.envelope_id = w.envelope_id and r.template_role_id = (b->>'role_id')::uuid and r.removed_at is null and r.role <> 'cc';
    if v_rid is null then
      raise exception 'A signing block belongs to a role that isn''t on this envelope.' using errcode = 'GSN12';
    end if;
    if (b->>'page')::int not between 0 and _page_count - 1 then
      raise exception 'A signing block sits outside the rendered pages.' using errcode = 'GSN12';
    end if;
    if coalesce(b->>'kind', 'signature') not in ('signature', 'initials', 'date', 'name', 'text', 'checkbox') then
      raise exception 'A signing block has a kind a signer can''t fill.' using errcode = 'GSN12';
    end if;
    insert into public.sign_fields (tenant_id, envelope_id, recipient_id, type, page, x, y, w, h, required, label)
    values (w.tenant_id, w.envelope_id, v_rid, coalesce(b->>'kind', 'signature'), v_before + (b->>'page')::int,
            round((b->>'x')::numeric, 3), round((b->>'y')::numeric, 3), round((b->>'w')::numeric, 3), round((b->>'h')::numeric, 3),
            coalesce((b->>'required')::boolean, true), nullif(left(btrim(coalesce(b->>'label', '')), 200), ''));
  end loop;

  update public.sign_written_docs set rendered_document_id = v_doc, render_error = null where id = w.id;
  perform set_config('gio.sign_rpc', '', true);
  return v_doc;
end;
$$;

-- ---- 4. The editor's Preview with a real offer -----------------------------------
-- The latest offer on _form_id (any form when null) in a workspace the caller
-- administers: { label, first_name, offer_id, values } with each
-- [key, format] in _uses added as "key|format". Empty when there's none.
create or replace function public.sign_sample_values(_form_id uuid, _uses jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_offer uuid;
  rec jsonb;
begin
  select ol.id into v_offer
  from public.offer_letters ol
  join public.jobs j on j.id = ol.job_id
  where (_form_id is null or ol.form_id = _form_id)
    and coalesce(ol.status, '') <> 'declined'
    and public.sign_is_admin(j.tenant_id)
  order by ol.updated_at desc nulls last
  limit 1;
  if v_offer is null then
    return jsonb_build_object('label', null, 'first_name', null, 'offer_id', null, 'values', '{}'::jsonb);
  end if;
  rec := public.sign_record_values('ats_offer', v_offer, null);
  return jsonb_build_object(
    'label', rec->'label',
    'first_name', nullif(split_part(btrim(coalesce(rec->'values'->>'name', '')), ' ', 1), ''),
    'offer_id', v_offer,
    'values', (rec->'values') || public.sign_variants(rec, _uses));
end;
$$;

revoke all on function public.sign_num_words(bigint), public.sign_format(text, text, jsonb, text),
  public.sign_value_variant(jsonb, text, text), public.sign_template_uses(uuid), public.sign_variants(jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.sign_sample_values(uuid, jsonb) from public, anon;
grant execute on function public.sign_sample_values(uuid, jsonb) to authenticated;
revoke all on function public.sign_attach_render(uuid, text, int, jsonb, int, text, jsonb) from public, anon, authenticated;
grant execute on function public.sign_attach_render(uuid, text, int, jsonb, int, text, jsonb) to service_role;
