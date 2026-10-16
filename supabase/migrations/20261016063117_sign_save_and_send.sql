-- Gio Sign, build step 6: saving templates in one go, and sending from a record.
--
-- 1. sign_save_template(jsonb): the template wizard's save. One call, all or
--    nothing. It replaces the client upserts from step 5, which RLS refuses for
--    a brand-new template (INSERT ... ON CONFLICT checks the read policy on a
--    row that doesn't exist yet). Admins only.
-- 2. sign_record_values(...): the data tag values for a template and a record
--    (candidate or offer, or a member), plus who the record says signs first.
-- 3. sign_send_preview(...): what the send sheet shows before sending.
-- 4. sign_send(...): creates the envelope from the template (documents, roles,
--    fields), freezes the values, and queues it (5-second Undo) or schedules it.
--    Admins, or a TA on the candidate's job. Customer envelopes come from Gio
--    Sales through the gateway in a later step, not from here.
--
-- Emails are a later step: a queued envelope waits for the dispatcher, so the
-- app keeps its Send buttons hidden until that step ships.

-- ---------------------------------------------------------------------------
-- 0. Counting a template's uses doesn't count as editing it
-- ---------------------------------------------------------------------------
create or replace function public.sign_touch()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('gio.sign_count', true), '') = 'on' then
    return new;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 1. Save a template (admins)
-- ---------------------------------------------------------------------------
-- _t: { id, tenant_id, name, description, kind, app, ordered, subject, body,
--       reminder_days, expiry_days,
--       docs:   [{ id, name, storage_path, page_count, page_sizes, size_bytes, sha256 }],
--       roles:  [{ id, label, role, fixed, name, email, color }],
--       fields: [{ id, type, rid, page, x, y, w, h, required, data_key }] }
-- Arrays are in order. Rows missing from an array are soft-removed.
create or replace function public.sign_save_template(_t jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid := (_t->>'id')::uuid;
  v_ten uuid := (_t->>'tenant_id')::uuid;
  v_old_ten uuid;
  v_pages int;
  v_doc_ids uuid[];
  v_role_ids uuid[];
  v_field_ids uuid[];
  v_bad text;
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

  -- Checks the editor also makes, so a template can always be sent.
  if jsonb_array_length(coalesce(_t->'docs', '[]')) = 0 then
    raise exception 'Add at least one PDF.' using errcode = 'GSN12';
  end if;
  select string_agg(x->>'name', ', ') into v_bad
  from jsonb_array_elements(_t->'docs') x
  where coalesce(x->>'storage_path', '') not like v_ten::text || '/templates/%';
  if v_bad is not null then
    raise exception 'These documents weren''t uploaded to this workspace: %', v_bad using errcode = 'GSN12';
  end if;
  select coalesce(sum((x->>'page_count')::int), 0) into v_pages from jsonb_array_elements(_t->'docs') x;
  if v_pages > 200 then
    raise exception 'A template can hold up to 200 pages.' using errcode = 'GSN12';
  end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(_t->'roles', '[]')) r where r->>'role' = 'signer') then
    raise exception 'Add at least one signer.' using errcode = 'GSN12';
  end if;
  select string_agg(r->>'label', ', ') into v_bad
  from jsonb_array_elements(_t->'roles') r
  where r->>'role' = 'signer'
    and not exists (
      select 1 from jsonb_array_elements(coalesce(_t->'fields', '[]')) f
      where f->>'rid' = r->>'id' and f->>'type' = 'signature');
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
  select string_agg(f->>'page', ', ') into v_bad
  from jsonb_array_elements(coalesce(_t->'fields', '[]')) f
  where (f->>'page')::int >= v_pages;
  if v_bad is not null then
    raise exception 'Some fields sit on a page that isn''t in the documents.' using errcode = 'GSN12';
  end if;

  insert into public.sign_templates as t
    (id, tenant_id, name, description, kind, app, ordered, subject, body, reminder_days, expiry_days, created_by, updated_by)
  values (
    v_id, v_ten, btrim(_t->>'name'), nullif(btrim(coalesce(_t->>'description', '')), ''),
    (_t->>'kind')::public.sign_kind, _t->>'app', coalesce((_t->>'ordered')::boolean, true),
    btrim(coalesce(_t->>'subject', '')), coalesce(_t->>'body', ''),
    coalesce((_t->>'reminder_days')::smallint, 2), coalesce((_t->>'expiry_days')::smallint, 30),
    auth.uid(), auth.uid())
  on conflict (id) do update set
    name = excluded.name, description = excluded.description, kind = excluded.kind, app = excluded.app,
    ordered = excluded.ordered, subject = excluded.subject, body = excluded.body,
    reminder_days = excluded.reminder_days, expiry_days = excluded.expiry_days, updated_by = auth.uid();

  -- Documents
  insert into public.sign_documents as d
    (id, tenant_id, template_id, position, name, storage_path, page_count, page_sizes, size_bytes, sha256, removed_at)
  select x.id, v_ten, v_id, (x.ord - 1)::smallint, x.name, x.storage_path, x.page_count::smallint,
         coalesce(x.page_sizes, '[]'::jsonb), x.size_bytes, x.sha256, null
  from rows from (jsonb_to_recordset(_t->'docs')
         as (id uuid, name text, storage_path text, page_count int, page_sizes jsonb, size_bytes int, sha256 text))
       with ordinality as x(id, name, storage_path, page_count, page_sizes, size_bytes, sha256, ord)
  on conflict (id) do update set
    position = excluded.position, name = excluded.name, storage_path = excluded.storage_path,
    page_count = excluded.page_count, page_sizes = excluded.page_sizes, size_bytes = excluded.size_bytes,
    sha256 = excluded.sha256, removed_at = null;

  -- Roles
  insert into public.sign_recipients as r
    (id, tenant_id, template_id, position, role, label, fixed, name, email, color, removed_at)
  select x.id, v_ten, v_id, x.ord::smallint, x.role::public.sign_recipient_role, btrim(x.label),
         coalesce(x.fixed, false),
         case when x.fixed then nullif(btrim(x.name), '') end,
         case when x.fixed then lower(btrim(x.email)) end,
         x.color, null
  from rows from (jsonb_to_recordset(_t->'roles')
         as (id uuid, label text, role text, fixed boolean, name text, email text, color text))
       with ordinality as x(id, label, role, fixed, name, email, color, ord)
  on conflict (id) do update set
    position = excluded.position, role = excluded.role, label = excluded.label, fixed = excluded.fixed,
    name = excluded.name, email = excluded.email, color = excluded.color, removed_at = null;

  -- Fields
  insert into public.sign_fields as f
    (id, tenant_id, template_id, recipient_id, type, page, x, y, w, h, required, data_key, removed_at)
  select x.id, v_ten, v_id,
         case when x.type = 'data' then null else x.rid end,
         x.type, x.page::smallint,
         round(x.x, 3), round(x.y, 3), round(x.w, 3), round(x.h, 3),
         case when x.type = 'data' then true else coalesce(x.required, true) end,
         case when x.type = 'data' then x.data_key end,
         null
  from jsonb_to_recordset(coalesce(_t->'fields', '[]'))
       as x(id uuid, type text, rid uuid, page int, x numeric, y numeric, w numeric, h numeric, required boolean, data_key text)
  on conflict (id) do update set
    recipient_id = excluded.recipient_id, type = excluded.type, page = excluded.page,
    x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h,
    required = excluded.required, data_key = excluded.data_key, removed_at = null;

  -- Soft-remove what the editor dropped.
  select coalesce(array_agg((x->>'id')::uuid), '{}') into v_doc_ids from jsonb_array_elements(_t->'docs') x;
  select coalesce(array_agg((x->>'id')::uuid), '{}') into v_role_ids from jsonb_array_elements(_t->'roles') x;
  select coalesce(array_agg((x->>'id')::uuid), '{}') into v_field_ids from jsonb_array_elements(coalesce(_t->'fields', '[]')) x;
  update public.sign_fields set removed_at = now()
   where template_id = v_id and removed_at is null and not (id = any(v_field_ids));
  update public.sign_recipients set removed_at = now()
   where template_id = v_id and removed_at is null and not (id = any(v_role_ids));
  update public.sign_documents set removed_at = now()
   where template_id = v_id and removed_at is null and not (id = any(v_doc_ids));

  return v_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Data tag values for a record
-- ---------------------------------------------------------------------------
-- The labels the app shows for each tag (missing values are named with them).
create or replace function public.sign_tag_label(_key text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select coalesce(jsonb_build_object(
    'company', 'Company', 'contact', 'Contact name', 'contact_email', 'Contact email', 'deal', 'Deal name',
    'value', 'Deal value', 'currency', 'Currency', 'fee', 'Fee', 'openings', 'Openings', 'start', 'Start date',
    'owner', 'Deal owner', 'name', 'Name', 'job', 'Job title', 'salary', 'Salary', 'role', 'Role',
    'email', 'Email', 'today', 'Today''s date', 'sender', 'Sender name') ->> _key, _key);
$function$;

-- A number written plainly ("45000" or "45000.5") reads "45,000" / "45,000.50".
create or replace function public.sign_fmt_amount(_v text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when _v is null or btrim(_v) = '' then null
    when btrim(_v) !~ '^[0-9]+(\.[0-9]+)?$' then btrim(_v)
    when btrim(_v)::numeric = trunc(btrim(_v)::numeric) then to_char(btrim(_v)::numeric, 'FM999,999,999,999')
    else to_char(btrim(_v)::numeric, 'FM999,999,999,990.00')
  end;
$function$;

-- A date written as YYYY-MM-DD reads "March 3, 2027"; anything else stays as written.
create or replace function public.sign_fmt_date(_v text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when _v is null or btrim(_v) = '' then null
    when btrim(_v) ~ '^\d{4}-\d{2}-\d{2}' then to_char(left(btrim(_v), 10)::date, 'FMMonth FMDD, YYYY')
    else btrim(_v)
  end;
$function$;

-- Returns { tenant_id, kind, job_id, candidate_id, offer_id, label, values,
--           person: { name, email } } for a record the caller may read.
-- _source_type: 'ats_offer' (source = offer_letters.id), 'candidate'
-- (source = candidates.id, needs _job_id), or 'member' (source = members.id).
create or replace function public.sign_record_values(_source_type public.sign_source, _source_id uuid, _job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_ten uuid; v_cand uuid; v_job uuid; v_offer uuid; v_fv jsonb := '{}'; v_cur text;
  v_name text; v_email text; v_job_title text; v_salary text; v_start text; v_role text;
  v_hire_start date; v_sender text; v_values jsonb; v_label text;
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
    -- The latest offer for this candidate and job (if any) supplies salary and start.
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

    v_cur := nullif(btrim(coalesce(v_fv->>'currency', '')), '');
    v_salary := public.sign_fmt_amount(coalesce(nullif(v_fv->>'base_salary', ''), nullif(v_fv->>'gross_monthly_salary', '')));
    v_start := coalesce(public.sign_fmt_date(v_fv->>'start_date'), public.sign_fmt_date(v_hire_start::text));
    v_values := jsonb_build_object(
      'name', coalesce(nullif(btrim(v_fv->>'candidate_s_full_legal_name'), ''), nullif(btrim(v_fv->>'full_legal_name'), ''), v_name),
      'job', coalesce(nullif(btrim(v_fv->>'job_title'), ''), v_job_title),
      'salary', case when v_salary is null then null else concat_ws(' ', v_cur, v_salary) end,
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
    'person', jsonb_build_object('name', coalesce(v_values->>'name', v_name), 'email', v_email));
end;
$function$;

-- May the caller send an envelope of this kind for this record?
create or replace function public.sign_can_send(_tenant_id uuid, _kind public.sign_kind, _job_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.is_active_member(_tenant_id)
     and (public.sign_is_admin(_tenant_id)
          or (_kind = 'candidate' and _job_id is not null and _job_id in (select public.my_job_ids())));
$function$;

-- ---------------------------------------------------------------------------
-- 3. What the send sheet shows
-- ---------------------------------------------------------------------------
-- Returns { label, values, missing: [labels], roles: [{ id, label, role, fixed,
-- name, email, color }] } with the first open signer prefilled from the record.
create or replace function public.sign_send_preview(
  _template_id uuid, _source_type public.sign_source, _source_id uuid, _job_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  t public.sign_templates;
  rec jsonb;
  v_missing jsonb;
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

  select coalesce(jsonb_agg(distinct public.sign_tag_label(f.data_key)), '[]') into v_missing
  from public.sign_fields f
  where f.template_id = t.id and f.removed_at is null and f.type = 'data'
    and coalesce(rec->'values'->>f.data_key, '') = '';

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

  return jsonb_build_object('label', rec->'label', 'values', rec->'values', 'missing', v_missing, 'roles', v_roles,
    'job_id', rec->'job_id', 'candidate_id', rec->'candidate_id', 'offer_id', rec->'offer_id');
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Send
-- ---------------------------------------------------------------------------
-- _people: [{ role_id, name, email }] for every role that isn't fixed.
-- _send_at: null sends now (queued, 5 seconds to Undo); a time schedules it.
-- _subject / _body: null keeps the template's message.
create or replace function public.sign_send(
  _template_id uuid, _source_type public.sign_source, _source_id uuid, _job_id uuid,
  _people jsonb, _send_at timestamptz default null, _subject text default null, _body text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t public.sign_templates;
  rec jsonb;
  v_values jsonb;
  v_missing text;
  v_env uuid;
  v_sender text;
  v_email text := public.sign_my_email();
  v_job uuid;
  v_cand uuid;
  v_n int;
  v_dup text;
  r record;
  v_map jsonb := '{}';
  v_new uuid;
  v_name text;
  v_addr text;
begin
  select * into t from public.sign_templates where id = _template_id and archived_at is null for update;
  if t.id is null then
    raise exception 'That template isn''t available.' using errcode = 'GSN10';
  end if;
  rec := public.sign_record_values(_source_type, _source_id, _job_id);
  v_job := (rec->>'job_id')::uuid;
  v_cand := (rec->>'candidate_id')::uuid;
  if (rec->>'tenant_id')::uuid <> t.tenant_id or t.app <> 'ats' or t.kind::text <> rec->>'kind' then
    raise exception 'That template can''t be used here.' using errcode = 'GSN10';
  end if;
  if not public.sign_can_send(t.tenant_id, t.kind, v_job) then
    raise exception 'You can''t send agreements for this record.' using errcode = '42501';
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

  v_values := rec->'values';
  select string_agg(distinct public.sign_tag_label(f.data_key), ', ') into v_missing
  from public.sign_fields f
  where f.template_id = t.id and f.removed_at is null and f.type = 'data'
    and coalesce(v_values->>f.data_key, '') = '';
  if v_missing is not null then
    raise exception 'Missing from the record: %. Add it there first.', v_missing using errcode = 'GSN14';
  end if;

  -- Every open role needs a person; nobody signs twice.
  for r in
    select tr.* from public.sign_recipients tr
    where tr.template_id = t.id and tr.removed_at is null order by tr.position
  loop
    if r.fixed then
      v_name := r.name; v_addr := r.email;
    else
      select nullif(btrim(p->>'name'), ''), lower(nullif(btrim(p->>'email'), ''))
        into v_name, v_addr
      from jsonb_array_elements(coalesce(_people, '[]')) p
      where (p->>'role_id')::uuid = r.id;
    end if;
    if v_name is null or v_addr is null or v_addr !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_name) > 120 then
      raise exception '% needs a name and a valid email.', r.label using errcode = 'GSN13';
    end if;
    v_map := v_map || jsonb_build_object(r.id::text, jsonb_build_object('name', v_name, 'email', v_addr));
  end loop;
  select string_agg(e, ', ') into v_dup from (
    select v->>'email' e from jsonb_each(v_map) x(k, v)
    join public.sign_recipients tr on tr.id = x.k::uuid and tr.role <> 'cc'
    group by 1 having count(*) > 1) d;
  if v_dup is not null then
    raise exception '% is on more than one signing role.', v_dup using errcode = 'GSN13';
  end if;

  select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '') into v_sender
  from public.profiles p where p.user_id = auth.uid();

  perform set_config('gio.sign_rpc', 'on', true);

  insert into public.sign_envelopes (
    tenant_id, title, kind, status, template_id, source_type, source_id, source_label,
    ats_job_id, ats_candidate_id, ordered, subject, body, reminder_days, expiry_days, data_snapshot,
    origin, sender_user_id, sender_name, sender_email, scheduled_at, dispatch_at, created_by)
  values (
    t.tenant_id,
    left(t.name || ' · ' || coalesce(v_values->>'name', rec->>'label'), 200),
    t.kind,
    case when _send_at is null then 'queued' else 'scheduled' end::public.sign_status,
    t.id, _source_type, _source_id, rec->>'label',
    v_job, v_cand, t.ordered,
    coalesce(btrim(_subject), t.subject), coalesce(_body, t.body), t.reminder_days, t.expiry_days, v_values,
    'ats', auth.uid(), coalesce(v_sender, v_email), v_email,
    _send_at, case when _send_at is null then now() + interval '5 seconds' end, auth.uid())
  returning id into v_env;

  -- Documents: the same stored files (template files are never replaced).
  insert into public.sign_documents (tenant_id, envelope_id, position, name, storage_path, page_count, page_sizes, size_bytes, sha256)
  select t.tenant_id, v_env, d.position, d.name, d.storage_path, d.page_count, d.page_sizes, d.size_bytes, d.sha256
  from public.sign_documents d
  where d.template_id = t.id and d.removed_at is null;

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

  -- Fields; data fields carry their frozen value.
  insert into public.sign_fields (tenant_id, envelope_id, recipient_id, type, page, x, y, w, h, required, data_key, label, value, filled_at)
  select t.tenant_id, v_env,
         case when f.recipient_id is null then null else (v_map->f.recipient_id::text->>'new')::uuid end,
         f.type, f.page, f.x, f.y, f.w, f.h, f.required, f.data_key, f.label,
         case when f.type = 'data' then v_values->>f.data_key end,
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
$function$;

revoke execute on function
  public.sign_save_template(jsonb),
  public.sign_record_values(public.sign_source, uuid, uuid),
  public.sign_can_send(uuid, public.sign_kind, uuid),
  public.sign_send_preview(uuid, public.sign_source, uuid, uuid),
  public.sign_send(uuid, public.sign_source, uuid, uuid, jsonb, timestamptz, text, text)
  from public, anon;
grant execute on function
  public.sign_save_template(jsonb),
  public.sign_can_send(uuid, public.sign_kind, uuid),
  public.sign_send_preview(uuid, public.sign_source, uuid, uuid),
  public.sign_send(uuid, public.sign_source, uuid, uuid, jsonb, timestamptz, text, text)
  to authenticated;
grant execute on function public.sign_record_values(public.sign_source, uuid, uuid) to service_role;
