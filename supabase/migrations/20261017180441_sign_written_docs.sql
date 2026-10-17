-- Written documents (Gio Sign x offers, step 2, 2026-10-17)
--
-- A template can hold documents written in Gio, next to uploaded PDFs. A
-- written document is the editor's own JSON (Lexical): text, headings, lists,
-- data tags (type "placeholder", placeholderKey), conditional sections
-- (type "gio-if": key, op, value) and signing blocks (type "gio-sign":
-- roleId, kind). The PDF is made by the server when the envelope goes out,
-- with the values frozen at send time, and joins the envelope like an
-- uploaded document.
--
-- 1. sign_written_docs: written documents of a template, and their frozen
--    copies on an envelope (with the PDF made from them once rendered).
-- 2. sign_written_nodes() / sign_template_keys(): which values a template
--    fills in, from placed data fields and written text. A value used only
--    inside a conditional section never blocks a send.
-- 3. sign_save_template: saves written documents with the rest; a signing
--    block counts as the signer's signature field; tags and blocks are checked
--    like placed fields. Documents keep the order the editor gives.
-- 4. sign_send / sign_send_preview / sign_optional_keys /
--    sign_offer_fingerprint: written values count like placed ones.
-- 5. sign_claim_due waits until every written document of an envelope has its
--    PDF; sign_attach_render (service role, sign-dispatch) attaches it, adds
--    the signing blocks as fields and moves later pages down.

-- ---- 1. The table ---------------------------------------------------------
create table public.sign_written_docs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  envelope_id uuid references public.sign_envelopes(id),
  template_id uuid references public.sign_templates(id),
  position smallint not null default 0 check (position between 0 and 49),
  name text not null check (length(btrim(name)) between 1 and 200),
  content jsonb not null check (jsonb_typeof(content) = 'object' and content ? 'root' and pg_column_size(content) <= 524288),
  -- Envelope copies: the PDF made from it at send time.
  rendered_document_id uuid references public.sign_documents(id),
  render_error text check (render_error is null or length(render_error) <= 500),
  render_attempts smallint not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  check (num_nonnulls(envelope_id, template_id) = 1),
  check (rendered_document_id is null or envelope_id is not null)
);
create index sign_written_docs_template on public.sign_written_docs (template_id, position) where template_id is not null and removed_at is null;
create index sign_written_docs_envelope on public.sign_written_docs (envelope_id, position) where envelope_id is not null and removed_at is null;
create index sign_written_docs_pending on public.sign_written_docs (envelope_id) where envelope_id is not null and rendered_document_id is null and removed_at is null;
create index sign_written_docs_rendered on public.sign_written_docs (rendered_document_id) where rendered_document_id is not null;
comment on table public.sign_written_docs is
  'Documents written in Gio (Lexical JSON). Template rows are edited by admins; envelope rows are frozen copies, rendered to a PDF by sign-dispatch.';

-- Tenant and parent, like the other children.
create trigger sign_written_docs_a_guard before insert or update on public.sign_written_docs
  for each row execute function public.sign_children_guard();

-- Only Gio Sign sets what was rendered.
create or replace function public.sign_written_docs_guard()
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
    new.rendered_document_id := null;
    new.render_error := null;
    new.render_attempts := 0;
  else
    new.rendered_document_id := old.rendered_document_id;
    new.render_error := old.render_error;
    new.render_attempts := old.render_attempts;
  end if;
  return new;
end;
$$;
create trigger sign_written_docs_b_render before insert or update on public.sign_written_docs
  for each row execute function public.sign_written_docs_guard();

alter table public.sign_written_docs enable row level security;
create policy sign_written_docs_read on public.sign_written_docs for select to authenticated
  using ((envelope_id is not null and public.sign_can_view_envelope(envelope_id))
      or (template_id is not null and public.sign_can_view_template(template_id)));
create policy sign_written_docs_insert on public.sign_written_docs for insert to authenticated
  with check ((envelope_id is not null and public.sign_can_edit_envelope(envelope_id))
           or (template_id is not null and public.sign_can_edit_template(template_id)));
create policy sign_written_docs_update on public.sign_written_docs for update to authenticated
  using ((envelope_id is not null and public.sign_can_edit_envelope(envelope_id))
      or (template_id is not null and public.sign_can_edit_template(template_id)));
grant select, insert, update on public.sign_written_docs to authenticated;
grant all on public.sign_written_docs to service_role;

-- ---- 2. What a template fills in -------------------------------------------
-- Every node of a written document, and whether it sits inside a conditional section.
create or replace function public.sign_written_nodes(_content jsonb)
returns table (node jsonb, conditional boolean)
language sql
immutable
set search_path = public
as $$
  with recursive n(node, conditional, depth) as (
    select _content->'root', false, 0
    union all
    select c.value, n.conditional or (n.node->>'type' = 'gio-if'), n.depth + 1
    from n
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(n.node->'children') = 'array' then n.node->'children' else '[]'::jsonb end) c
    where n.depth < 40
  )
  select n.node, n.conditional from n where n.node is not null;
$$;

-- The values a template fills in. needed: placed as a field, or written
-- outside any conditional section (so an empty value can block a send);
-- false for values used only inside conditional sections or as a condition.
create or replace function public.sign_template_keys(_template_id uuid)
returns table (key text, needed boolean)
language sql
stable
security definer
set search_path = public
as $$
  select s.k, bool_or(s.needed)
  from (
    select f.data_key as k, true as needed
    from public.sign_fields f
    where f.template_id = _template_id and f.removed_at is null and f.type = 'data'
    union all
    select x.node->>'placeholderKey', not x.conditional
    from public.sign_written_docs w
    cross join lateral public.sign_written_nodes(w.content) x
    where w.template_id = _template_id and w.removed_at is null and x.node->>'type' = 'placeholder'
    union all
    select x.node->>'key', false
    from public.sign_written_docs w
    cross join lateral public.sign_written_nodes(w.content) x
    where w.template_id = _template_id and w.removed_at is null and x.node->>'type' = 'gio-if'
  ) s
  where s.k is not null and btrim(s.k) <> ''
  group by s.k;
$$;
revoke all on function public.sign_template_keys(uuid) from public, anon, authenticated;

-- Values that may print blank: used only conditionally, or an optional field
-- of the offer form. Standard values are optional only when used conditionally.
create or replace function public.sign_optional_keys(_template_id uuid, _form_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(k.key), '{}')
  from public.sign_template_keys(_template_id) k
  where not k.needed
     or (k.key not in ('name', 'job', 'salary', 'start', 'today', 'sender')
         and exists (select 1 from public.offer_form_fields ff
                     where ff.form_id = _form_id and ff.field_name = k.key and not ff.is_required));
$$;
revoke all on function public.sign_optional_keys(uuid, uuid) from public, anon, authenticated;

-- The fingerprint covers written values too.
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
  select coalesce(jsonb_object_agg(k.key, rec->'values'->k.key), '{}'::jsonb) into v
  from public.sign_template_keys(_template_id) k
  where k.key not in ('today', 'sender');
  return md5(v::text);
end;
$$;
revoke all on function public.sign_offer_fingerprint(uuid, uuid) from public, anon, authenticated;

-- ---- 3. Template save -------------------------------------------------------
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
  -- A signing block in written text counts as the signer's signature field.
  select string_agg(r->>'label', ', ') into v_bad
  from jsonb_array_elements(_t->'roles') r
  where r->>'role' = 'signer'
    and not exists (
      select 1 from jsonb_array_elements(coalesce(_t->'fields', '[]')) f
      where f->>'rid' = r->>'id' and f->>'type' = 'signature')
    and not exists (
      select 1 from jsonb_array_elements(v_written) w
      cross join lateral public.sign_written_nodes(w->'content') x
      where x.node->>'type' = 'gio-sign' and x.node->>'roleId' = r->>'id' and coalesce(x.node->>'kind', 'signature') = 'signature');
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
    (id, tenant_id, template_id, recipient_id, type, page, x, y, w, h, required, data_key, font_size, data_style, removed_at)
  select x.id, v_ten, v_id,
         case when x.type = 'data' then null else x.rid end,
         x.type, x.page::smallint,
         round(x.x, 3), round(x.y, 3), round(x.w, 3), round(x.h, 3),
         case when x.type = 'data' then true else coalesce(x.required, true) end,
         case when x.type = 'data' then x.data_key end,
         case when x.type in ('signature', 'initials', 'checkbox') or x.font_size is null then null
              else round(least(greatest(x.font_size, 6), 24) * 2) / 2 end,
         case when x.type = 'data' and x.data_style = 'tick' then 'tick' end,
         null
  from jsonb_to_recordset(coalesce(_t->'fields', '[]'))
       as x(id uuid, type text, rid uuid, page int, x numeric, y numeric, w numeric, h numeric, required boolean, data_key text, font_size numeric, data_style text)
  on conflict (id) do update set
    recipient_id = excluded.recipient_id, type = excluded.type, page = excluded.page,
    x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h,
    required = excluded.required, data_key = excluded.data_key, font_size = excluded.font_size,
    data_style = excluded.data_style, removed_at = null;

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

-- ---- 4. Preview and send ------------------------------------------------------
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'label', r.label, 'role', r.role, 'fixed', r.fixed, 'color', r.color,
    'name', case when r.fixed then r.name when r.id = v_first then rec->'person'->>'name' else '' end,
    'email', case when r.fixed then r.email when r.id = v_first then rec->'person'->>'email' else '' end)
    order by r.position), '[]') into v_roles
  from public.sign_recipients r
  where r.template_id = t.id and r.removed_at is null;

  return jsonb_build_object('label', rec->'label', 'values', rec->'values', 'used', v_used,
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

  -- Fields; data fields carry their frozen value (null when optional and empty).
  insert into public.sign_fields (tenant_id, envelope_id, recipient_id, type, page, x, y, w, h, required, data_key, font_size, data_style, label, value, filled_at)
  select t.tenant_id, v_env,
         case when f.recipient_id is null then null else (v_map->f.recipient_id::text->>'new')::uuid end,
         f.type, f.page, f.x, f.y, f.w, f.h, f.required, f.data_key, f.font_size, f.data_style, f.label,
         case when f.type = 'data' then nullif(v_values->>f.data_key, '') end,
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

-- ---- 5. Rendering before sending ------------------------------------------------
-- Same as before, except an envelope waits until its written documents have PDFs.
create or replace function public.sign_claim_due(_limit int default 50)
returns table (envelope_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  e record;
begin
  perform set_config('gio.sign_rpc', 'on', true);
  for e in
    select x.id, x.tenant_id, x.ordered, x.expiry_days, x.status
    from public.sign_envelopes x
    where x.deleted_at is null
      and ((x.status = 'queued' and x.dispatch_at <= now())
        or (x.status = 'scheduled' and x.scheduled_at <= now()))
      and not exists (
        select 1 from public.sign_written_docs w
        where w.envelope_id = x.id and w.removed_at is null and w.rendered_document_id is null)
    order by coalesce(x.dispatch_at, x.scheduled_at)
    limit greatest(1, least(_limit, 200))
    for update skip locked
  loop
    update public.sign_envelopes
       set status = 'sent', sent_at = now(), dispatch_at = null,
           expires_at = now() + make_interval(days => e.expiry_days)
     where id = e.id;

    update public.sign_recipients r
       set status = 'sent'
     where r.envelope_id = e.id and r.removed_at is null and r.role <> 'cc' and r.status = 'waiting'
       and (not e.ordered or r.position = (
             select min(q.position) from public.sign_recipients q
             where q.envelope_id = e.id and q.removed_at is null and q.role <> 'cc'));

    envelope_id := e.id;
    return next;
  end loop;
end;
$function$;

-- Attaches the PDF made from a written document: it takes the document's
-- place in the envelope, later pages move down, and its signing blocks become
-- fields for the matching people. _blocks: [{role_id (template role), kind,
-- page (within this PDF), x, y, w, h (% of the page)}]. Written documents are
-- attached in order, so page numbers before them are final.
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
    insert into public.sign_fields (tenant_id, envelope_id, recipient_id, type, page, x, y, w, h, required)
    values (w.tenant_id, w.envelope_id, v_rid, coalesce(b->>'kind', 'signature'), v_before + (b->>'page')::int,
            round((b->>'x')::numeric, 3), round((b->>'y')::numeric, 3), round((b->>'w')::numeric, 3), round((b->>'h')::numeric, 3), true);
  end loop;

  update public.sign_written_docs set rendered_document_id = v_doc, render_error = null where id = w.id;
  perform set_config('gio.sign_rpc', '', true);
  return v_doc;
end;
$$;
revoke all on function public.sign_attach_render(uuid, text, int, jsonb, int, text, jsonb) from public, anon, authenticated;
grant execute on function public.sign_attach_render(uuid, text, int, jsonb, int, text, jsonb) to service_role;

-- A failed render: kept for the sender to see, retried a few times.
create or replace function public.sign_render_failed(_written_id uuid, _error text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.sign_written_docs
     set render_error = left(coalesce(nullif(btrim(_error), ''), 'The document couldn''t be made.'), 500),
         render_attempts = least(render_attempts + 1, 100)
   where id = _written_id and envelope_id is not null and rendered_document_id is null;
$$;
revoke all on function public.sign_render_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.sign_render_failed(uuid, text) to service_role;
