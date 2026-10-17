-- Sending offers for signature (Gio Sign × offers, phase 2, 2026-10-17)
--
-- 1. offer_can_send(): the one rule for whether an offer can go out, used by the
--    candidate profile and enforced again in sign_send. No approval chain on the
--    job means an offer can be sent as soon as it exists; with a chain, only once
--    every step is approved. An offer that is already out, or already signed,
--    can't be sent again (Void & resend comes later).
-- 2. Templates can be linked to an offer form (sign_templates.offer_form_id).
--    A linked template may fill in any field of that form; an unlinked one works
--    with any candidate and uses only the standard values.
-- 3. Envelopes remember the offer they came from (offer_id), a fingerprint of
--    the offer values they used, and whether the offer changed since
--    (out_of_date). A trigger on offer_letters keeps out_of_date current.
-- 4. The offer's status follows its envelope: sent, accepted (signed by
--    everyone), declined, or back to where it was when voided or expired.

-- ── 2. Templates linked to an offer form ─────────────────────────────────────
alter table public.sign_templates
  add column if not exists offer_form_id uuid references public.offer_forms(id);
comment on column public.sign_templates.offer_form_id is
  'The offer form this template fills in; null means it works with any candidate and uses only name/job/salary/start.';
create index if not exists sign_templates_offer_form_idx on public.sign_templates (offer_form_id) where offer_form_id is not null;

-- ── 3. Envelopes remember their offer ────────────────────────────────────────
alter table public.sign_envelopes
  add column if not exists offer_id uuid references public.offer_letters(id),
  add column if not exists offer_fingerprint text,
  add column if not exists out_of_date boolean not null default false;
create index if not exists sign_envelopes_offer_idx on public.sign_envelopes (offer_id) where offer_id is not null;

-- Keys an envelope's values are compared on: what the template fills in,
-- minus the ones that change on their own (today, sender).
-- Volatile on purpose, all the way down: a stable function reads the offer as
-- it was when the calling statement began, so the out-of-date trigger would
-- never see the edit it is reacting to.
alter function public.sign_record_values(sign_source, uuid, uuid) volatile;
alter function public.sign_offer_values(uuid) volatile;

create or replace function public.sign_offer_fingerprint(_offer_id uuid, _template_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  rec jsonb;
  v jsonb;
begin
  rec := public.sign_record_values('ats_offer', _offer_id, null);
  select coalesce(jsonb_object_agg(k, rec->'values'->k), '{}'::jsonb) into v
  from (select distinct f.data_key as k
        from public.sign_fields f
        where f.template_id = _template_id and f.removed_at is null and f.type = 'data'
          and f.data_key not in ('today', 'sender')) x;
  return md5(v::text);
end;
$$;
revoke all on function public.sign_offer_fingerprint(uuid, uuid) from public, anon, authenticated;

-- ── 1. The send rule ─────────────────────────────────────────────────────────
-- Returns {ok, reason, chain, request_status, envelope_id, envelope_status}.
-- reason: no_offer · declined · needs_approval · pending_approval ·
--         approval_declined · already_out · already_signed · (null when ok)
create or replace function public.offer_can_send(_offer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o record;
  v_ten uuid;
  v_chain boolean;
  v_req record;
  v_env record;
  v_reason text;
begin
  select ol.id, ol.job_id, ol.candidate_id, ol.status into o
  from public.offer_letters ol where ol.id = _offer_id;
  if o.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_offer', 'chain', false);
  end if;
  select j.tenant_id into v_ten from public.jobs j where j.id = o.job_id;
  if v_ten is null or not public.is_active_member(v_ten) then
    return jsonb_build_object('ok', false, 'reason', 'no_offer', 'chain', false);
  end if;

  v_chain := exists (
    select 1 from public.offer_approval_chains c
    join public.offer_approval_chain_steps s on s.chain_id = c.id
    where c.job_id = o.job_id and c.is_enabled);

  select r.id, r.status,
         exists (select 1 from public.offer_approval_request_steps st
                 where st.request_id = r.id and st.status not in ('approved', 'skipped')) as open_steps
    into v_req
  from public.offer_approval_requests r
  where r.offer_letter_id = o.id
  order by r.created_at desc limit 1;

  select e.id, e.status into v_env
  from public.sign_envelopes e
  where e.offer_id = o.id and e.deleted_at is null
    and e.status in ('scheduled', 'queued', 'sent', 'completed')
  order by (e.status = 'completed') desc, e.created_at desc limit 1;

  v_reason := case
    when coalesce(o.status, '') = 'declined' then 'declined'
    when v_env.status = 'completed' then 'already_signed'
    when v_env.id is not null then 'already_out'
    when v_chain and v_req.id is null then 'needs_approval'
    when v_chain and v_req.status = 'declined' then 'approval_declined'
    when v_chain and (v_req.status <> 'approved' or v_req.open_steps) then 'pending_approval'
    else null end;

  return jsonb_build_object(
    'ok', v_reason is null,
    'reason', v_reason,
    'chain', v_chain,
    'request_status', v_req.status,
    'envelope_id', v_env.id,
    'envelope_status', v_env.status);
end;
$$;
grant execute on function public.offer_can_send(uuid) to authenticated;

-- The message a refusal shows (shared by the sheet and sign_send).
create or replace function public.offer_send_refusal(_reason text)
returns text
language sql
immutable
set search_path = public
as $$
  select case _reason
    when 'no_offer' then 'Create the offer first.'
    when 'declined' then 'This offer was declined. Create a new one to send it again.'
    when 'needs_approval' then 'This job needs offers approved first. Request approval, then send.'
    when 'pending_approval' then 'Waiting for approval. It can be sent once every approver has approved.'
    when 'approval_declined' then 'An approver declined this offer. Edit it and request approval again.'
    when 'already_out' then 'This offer is already out for signature. Void it to send a new one.'
    when 'already_signed' then 'This offer is already signed.'
    else 'This offer can''t be sent right now.' end;
$$;

-- ── Template save: the form link and the fields it allows ────────────────────
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
  -- Data fields: the standard values, plus the linked form's fields.
  select string_agg(distinct f->>'data_key', ', ') into v_bad
  from jsonb_array_elements(coalesce(_t->'fields', '[]')) f
  where f->>'type' = 'data'
    and f->>'data_key' not in ('today', 'sender')
    and not (_t->>'kind' = 'candidate' and f->>'data_key' in ('name', 'job', 'salary', 'start'))
    and not (_t->>'kind' = 'member' and f->>'data_key' in ('name', 'role', 'email'))
    and not (_t->>'kind' = 'customer' and f->>'data_key' in ('company', 'contact', 'contact_email', 'deal', 'value', 'currency', 'fee', 'openings', 'start', 'owner'))
    and not (v_form is not null and exists (
      select 1 from public.offer_form_fields ff where ff.form_id = v_form and ff.field_name = f->>'data_key'));
  if v_bad is not null then
    raise exception 'These fields aren''t on the linked offer form: %', v_bad using errcode = 'GSN12';
  end if;

  insert into public.sign_templates as t
    (id, tenant_id, name, description, kind, app, ordered, subject, body, reminder_days, expiry_days, offer_form_id, created_by, updated_by)
  values (
    v_id, v_ten, btrim(_t->>'name'), nullif(btrim(coalesce(_t->>'description', '')), ''),
    (_t->>'kind')::public.sign_kind, _t->>'app', coalesce((_t->>'ordered')::boolean, true),
    btrim(coalesce(_t->>'subject', '')), coalesce(_t->>'body', ''),
    coalesce((_t->>'reminder_days')::smallint, 2), coalesce((_t->>'expiry_days')::smallint, 30),
    v_form, auth.uid(), auth.uid())
  on conflict (id) do update set
    name = excluded.name, description = excluded.description, kind = excluded.kind, app = excluded.app,
    ordered = excluded.ordered, subject = excluded.subject, body = excluded.body,
    reminder_days = excluded.reminder_days, expiry_days = excluded.expiry_days,
    offer_form_id = excluded.offer_form_id, updated_by = auth.uid();

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
    (id, tenant_id, template_id, recipient_id, type, page, x, y, w, h, required, data_key, font_size, removed_at)
  select x.id, v_ten, v_id,
         case when x.type = 'data' then null else x.rid end,
         x.type, x.page::smallint,
         round(x.x, 3), round(x.y, 3), round(x.w, 3), round(x.h, 3),
         case when x.type = 'data' then true else coalesce(x.required, true) end,
         case when x.type = 'data' then x.data_key end,
         case when x.type in ('signature', 'initials', 'checkbox') or x.font_size is null then null
              else round(least(greatest(x.font_size, 6), 24) * 2) / 2 end,
         null
  from jsonb_to_recordset(coalesce(_t->'fields', '[]'))
       as x(id uuid, type text, rid uuid, page int, x numeric, y numeric, w numeric, h numeric, required boolean, data_key text, font_size numeric)
  on conflict (id) do update set
    recipient_id = excluded.recipient_id, type = excluded.type, page = excluded.page,
    x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h,
    required = excluded.required, data_key = excluded.data_key, font_size = excluded.font_size, removed_at = null;

  -- Soft-remove what the editor took out.
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
$$;

-- ── Preview: the offer gate and the form fit, before sending ─────────────────
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
  v_gate jsonb := null;
  v_form uuid;
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
    'job_id', rec->'job_id', 'candidate_id', rec->'candidate_id', 'offer_id', rec->'offer_id',
    'gate', v_gate);
end;
$$;

-- ── Send: the gate, the form fit, the offer link and the fingerprint ─────────
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
  v_email text := public.sign_my_email();
  v_job uuid;
  v_cand uuid;
  v_offer uuid;
  v_gate jsonb;
  v_form uuid;
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
    -- Another agreement (NDA, policy…): not tied to the offer's lifecycle.
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

  v_values := rec->'values';
  select string_agg(distinct coalesce(rec->'labels'->>f.data_key, public.sign_tag_label(f.data_key)), ', ') into v_missing
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
    origin, sender_user_id, sender_name, sender_email, scheduled_at, dispatch_at, created_by,
    offer_id, offer_fingerprint)
  values (
    t.tenant_id,
    left(t.name || ' · ' || coalesce(v_values->>'name', rec->>'label'), 200),
    t.kind,
    case when _send_at is null then 'queued' else 'scheduled' end::public.sign_status,
    t.id, _source_type, _source_id, rec->>'label',
    v_job, v_cand, t.ordered,
    coalesce(btrim(_subject), t.subject), coalesce(_body, t.body), t.reminder_days, t.expiry_days, v_values,
    'ats', auth.uid(), coalesce(v_sender, v_email), v_email,
    _send_at, case when _send_at is null then now() + interval '5 seconds' end, auth.uid(),
    v_offer, case when v_offer is null then null else public.sign_offer_fingerprint(v_offer, t.id) end)
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
  insert into public.sign_fields (tenant_id, envelope_id, recipient_id, type, page, x, y, w, h, required, data_key, font_size, label, value, filled_at)
  select t.tenant_id, v_env,
         case when f.recipient_id is null then null else (v_map->f.recipient_id::text->>'new')::uuid end,
         f.type, f.page, f.x, f.y, f.w, f.h, f.required, f.data_key, f.font_size, f.label,
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
$$;

-- ── Guard: the offer link is set by sign_send only ───────────────────────────
create or replace function public.sign_envelopes_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if coalesce(auth.role(), '') = 'service_role'
     or coalesce(current_setting('gio.sign_rpc', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.sign_is_admin(new.tenant_id) then
      raise exception 'Send it from the deal or the candidate.' using errcode = 'GSN02';
    end if;
    if new.status <> 'draft' or new.origin <> 'ats' then
      raise exception 'New envelopes start as drafts.' using errcode = 'GSN01';
    end if;
    new.created_by := auth.uid();
    new.sender_user_id := auth.uid();
    new.sender_email := public.sign_my_email();
    new.data_snapshot := null;
    new.deleted_at := null;
    new.offer_id := null;
    new.offer_fingerprint := null;
    new.out_of_date := false;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.tenant_id is distinct from old.tenant_id
     or new.public_id is distinct from old.public_id
     or new.template_id is distinct from old.template_id
     or new.origin is distinct from old.origin
     or new.sender_user_id is distinct from old.sender_user_id
     or new.sender_email is distinct from old.sender_email
     or new.created_by is distinct from old.created_by
     or new.data_snapshot is distinct from old.data_snapshot
     or new.scheduled_at is distinct from old.scheduled_at
     or new.dispatch_at is distinct from old.dispatch_at
     or new.sent_at is distinct from old.sent_at
     or new.sealed_path is distinct from old.sealed_path
     or new.void_reason is distinct from old.void_reason
     or new.deleted_at is distinct from old.deleted_at
     or new.offer_id is distinct from old.offer_id
     or new.offer_fingerprint is distinct from old.offer_fingerprint
     or new.out_of_date is distinct from old.out_of_date then
    raise exception 'That change goes through Send, Schedule or Void.' using errcode = 'GSN03';
  end if;
  if old.status not in ('draft', 'scheduled') then
    raise exception 'Only drafts and scheduled envelopes can be edited. Use Correct for one that''s out for signature.' using errcode = 'GSN04';
  end if;
  return new;
end;
$$;

-- ── 4. The offer follows its envelope ────────────────────────────────────────
create or replace function public.sign_envelopes_offer_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next text;
  v_gate jsonb;
begin
  if new.offer_id is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status and new.deleted_at is not distinct from old.deleted_at then
    return null;
  end if;

  if new.deleted_at is not null then
    v_next := 'revert';
  else
    v_next := case new.status
      when 'queued' then 'sent'
      when 'sent' then 'sent'
      when 'completed' then 'accepted'
      when 'declined' then 'declined'
      when 'voided' then 'revert'
      when 'expired' then 'revert'
      when 'cancelled' then 'revert'
      else null end;
  end if;
  if v_next is null then
    return null;
  end if;

  if v_next = 'revert' then
    -- Back to where the offer was before it went out: approved under a cleared
    -- chain, otherwise a draft.
    select case
      when exists (select 1 from public.offer_approval_requests r
                   where r.offer_letter_id = new.offer_id and r.status = 'approved'
                     and not exists (select 1 from public.offer_approval_request_steps st
                                     where st.request_id = r.id and st.status not in ('approved', 'skipped')))
      then 'approved' else 'draft' end
    into v_next;
  end if;

  update public.offer_letters
     set status = v_next,
         sent_at = case when v_next = 'sent' then coalesce(sent_at, now()) else sent_at end
   where id = new.offer_id and status is distinct from v_next;
  return null;
end;
$$;

create trigger sign_envelopes_z_offer_status
  after insert or update of status, deleted_at on public.sign_envelopes
  for each row execute function public.sign_envelopes_offer_status();

-- ── 3. Offer edited while an envelope is out → out of date ───────────────────
create or replace function public.offer_letters_sign_out_of_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
begin
  if new.field_values is not distinct from old.field_values then
    return null;
  end if;
  perform set_config('gio.sign_rpc', 'on', true);
  for e in
    select x.id, x.template_id, x.offer_fingerprint
    from public.sign_envelopes x
    where x.offer_id = new.id and x.deleted_at is null and not x.out_of_date
      and x.status in ('scheduled', 'queued', 'sent')
  loop
    begin
      -- The flag is what the profile and the send rule read. A timeline event
      -- for it ('offer_changed') needs a new sign_events kind, which comes
      -- with the Void & resend step (a constraint change applied from desktop).
      if e.offer_fingerprint is distinct from public.sign_offer_fingerprint(new.id, e.template_id) then
        update public.sign_envelopes set out_of_date = true where id = e.id;
      end if;
    exception when others then
      -- Never block an offer edit over this; the next edit checks again.
      raise warning 'sign out-of-date check skipped for envelope %: %', e.id, sqlerrm;
    end;
  end loop;
  perform set_config('gio.sign_rpc', '', true);
  return null;
end;
$$;

create trigger offer_letters_z_sign_out_of_date
  after update of field_values on public.offer_letters
  for each row execute function public.offer_letters_sign_out_of_date();
