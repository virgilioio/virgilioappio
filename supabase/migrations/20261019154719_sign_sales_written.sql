-- Gio Sign: agreements sent from Gio Sales carry their written documents
-- (2026-10-19). sign_send_sales was written before templates could hold
-- documents written in Gio, so a Gio Sales template made only of written
-- documents went out with none. Now, as sign_send does for the ATS:
--   1. the values a template needs come from sign_template_keys (placed data
--      fields and written tags; a tag only a conditional section uses never
--      blocks), so a missing contact stops the send with a clear message;
--   2. written documents are copied onto the envelope, where sign-dispatch
--      makes their PDF with the frozen values before anyone is invited
--      (sign_claim_due already waits for it);
--   3. placed data fields keep their tick style and format.

create or replace function public.sign_send_sales(
  _template_id uuid, _sales_org_id uuid, _deal_id uuid, _company_id uuid, _label text,
  _sender_sales_user_id uuid, _sender_name text, _sender_email text,
  _values jsonb, _people jsonb, _send_at timestamptz default null,
  _subject text default null, _body text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t public.sign_templates;
  v_values jsonb;
  v_missing text;
  v_env uuid;
  v_n int;
  v_dup text;
  r record;
  v_map jsonb := '{}';
  v_new uuid;
  v_name text;
  v_addr text;
  v_sender_email text := lower(btrim(coalesce(_sender_email, '')));
  v_sender_name text := left(btrim(coalesce(_sender_name, '')), 120);
begin
  select * into t from public.sign_templates where id = _template_id and archived_at is null for update;
  if t.id is null or t.app <> 'sales' or t.kind <> 'customer' then
    raise exception 'That template isn''t available in Gio Sales.' using errcode = 'GSN10';
  end if;
  if _sales_org_id is null or _deal_id is null or _sender_sales_user_id is null or v_sender_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or v_sender_name = '' then
    raise exception 'The deal, the workspace and the sender are required.' using errcode = 'GSN13';
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

  -- Only the Customer tags, as text, plus today and sender.
  select coalesce(jsonb_object_agg(k, left(btrim(v), 300)), '{}'::jsonb) into v_values
  from jsonb_each_text(coalesce(_values, '{}'::jsonb)) x(k, v)
  where k in ('company', 'contact', 'contact_email', 'deal', 'value', 'currency', 'fee', 'openings', 'start', 'owner')
    and nullif(btrim(v), '') is not null;
  v_values := v_values || jsonb_build_object(
    'today', to_char(now() at time zone 'America/Mexico_City', 'FMMonth FMDD, YYYY'),
    'sender', v_sender_name);

  -- Every value the template needs, placed or written (one only a conditional
  -- section uses may be empty).
  select string_agg(distinct public.sign_tag_label(k.key), ', ') into v_missing
  from public.sign_template_keys(t.id) k
  where k.needed and coalesce(v_values->>k.key, '') = '';
  if v_missing is not null then
    raise exception 'Missing from the deal: %. Add it there first.', v_missing using errcode = 'GSN14';
  end if;

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

  perform set_config('gio.sign_rpc', 'on', true);
  perform set_config('gio.sign_actor_name', v_sender_name, true);
  perform set_config('gio.sign_actor_email', v_sender_email, true);

  insert into public.sign_envelopes (
    tenant_id, title, kind, status, template_id, source_type, source_id, source_label,
    sales_org_id, sales_company_id, ordered, subject, body, reminder_days, expiry_days, data_snapshot,
    origin, sender_sales_user_id, sender_name, sender_email, scheduled_at, dispatch_at)
  values (
    t.tenant_id,
    left(t.name || ' · ' || coalesce(v_values->>'company', nullif(btrim(_label), ''), 'Deal'), 200),
    'customer',
    case when _send_at is null then 'queued' else 'scheduled' end::public.sign_status,
    t.id, 'deal', _deal_id, left(nullif(btrim(_label), ''), 200),
    _sales_org_id, _company_id, t.ordered,
    coalesce(btrim(_subject), t.subject), coalesce(_body, t.body), t.reminder_days, t.expiry_days, v_values,
    'sales', _sender_sales_user_id, v_sender_name, v_sender_email,
    _send_at, case when _send_at is null then now() + interval '5 seconds' end)
  returning id into v_env;

  insert into public.sign_documents (tenant_id, envelope_id, position, name, storage_path, page_count, page_sizes, size_bytes, sha256)
  select t.tenant_id, v_env, d.position, d.name, d.storage_path, d.page_count, d.page_sizes, d.size_bytes, d.sha256
  from public.sign_documents d
  where d.template_id = t.id and d.removed_at is null;

  -- Written documents: frozen copies, rendered to a PDF (sign-dispatch) before anyone is invited.
  insert into public.sign_written_docs (tenant_id, envelope_id, position, name, content)
  select t.tenant_id, v_env, w.position, w.name, w.content
  from public.sign_written_docs w
  where w.template_id = t.id and w.removed_at is null;

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

  insert into public.sign_fields (tenant_id, envelope_id, recipient_id, type, page, x, y, w, h, required, data_key, font_size, data_style, data_format, label, value, filled_at)
  select t.tenant_id, v_env,
         case when f.recipient_id is null then null else (v_map->f.recipient_id::text->>'new')::uuid end,
         f.type, f.page, f.x, f.y, f.w, f.h, f.required, f.data_key, f.font_size, f.data_style, f.data_format, f.label,
         case when f.type = 'data' then v_values->>f.data_key end,
         case when f.type = 'data' then now() end
  from public.sign_fields f
  where f.template_id = t.id and f.removed_at is null;

  perform public.sign_log(v_env, 'created', 'Created from ' || t.name || ' in Gio Sales');
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
