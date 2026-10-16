-- Gio Sign, build step 12: Gio Sales sends agreements from deals.
--
-- Reps have no ATS account. Gio Sales' server (sign-link) checks the rep and
-- the deal, then calls the ATS sign-gateway, signed with GIO_LINK_SECRET.
-- The gateway runs as the service role and uses these functions:
--   * sign_send_sales: a Customer envelope from a Gio Sales template, with the
--     deal's values (read in Sales, frozen here) and the rep as sender.
--   * sign_sales_manage: Undo send, Send reminder, Void, Send now on a Sales
--     envelope, recorded under the rep's name.
-- Every step of a Sales envelope is queued for Gio Sales (integration_outbox,
-- event sign.<kind>) at commit, with a snapshot of where the envelope stands,
-- so Sales can keep its mirror, timeline, bell and the deal's files current.

-- ---------------------------------------------------------------------------
-- Who did it: Sales actions carry the rep's name in the trail
-- ---------------------------------------------------------------------------
create or replace function public.sign_log(
  _envelope_id uuid, _kind text, _label text, _key boolean default false, _detail jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into public.sign_events (tenant_id, envelope_id, kind, label, key, actor_name, actor_email, actor_user_id, detail)
  select e.tenant_id, e.id, _kind, _label, _key,
         coalesce(
           (select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '') from public.profiles p where p.user_id = auth.uid()),
           nullif(current_setting('gio.sign_actor_name', true), ''),
           public.sign_my_email()),
         coalesce(public.sign_my_email(), nullif(current_setting('gio.sign_actor_email', true), '')),
         auth.uid(), coalesce(_detail, '{}'::jsonb)
  from public.sign_envelopes e where e.id = _envelope_id;
$function$;

-- A Sales envelope is managed only by the gateway, inside sign_sales_manage.
create or replace function public.sign_can_manage_envelope(_envelope_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.sign_envelopes e
    where e.id = _envelope_id
      and (
        (e.origin = 'ats'
          and public.is_active_member(e.tenant_id)
          and (public.sign_is_admin(e.tenant_id) or e.sender_user_id = auth.uid()))
        or (e.origin = 'sales'
          and coalesce(auth.role(), '') = 'service_role'
          and coalesce(current_setting('gio.sign_sales_manage', true), '') = e.id::text)
      )
  );
$function$;

-- ---------------------------------------------------------------------------
-- Send from a deal (service role: sign-gateway)
-- ---------------------------------------------------------------------------
-- _values: the deal's tag values, read in Gio Sales (company, contact,
-- contact_email, deal, value, currency, fee, openings, start, owner).
-- _people: [{ role_id, name, email }] for the template's open roles.
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

  select string_agg(distinct public.sign_tag_label(f.data_key), ', ') into v_missing
  from public.sign_fields f
  where f.template_id = t.id and f.removed_at is null and f.type = 'data'
    and coalesce(v_values->>f.data_key, '') = '';
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

  insert into public.sign_fields (tenant_id, envelope_id, recipient_id, type, page, x, y, w, h, required, data_key, label, value, filled_at)
  select t.tenant_id, v_env,
         case when f.recipient_id is null then null else (v_map->f.recipient_id::text->>'new')::uuid end,
         f.type, f.page, f.x, f.y, f.w, f.h, f.required, f.data_key, f.label,
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

-- ---------------------------------------------------------------------------
-- Manage a Sales envelope (service role: sign-gateway)
-- ---------------------------------------------------------------------------
-- _action: undo | remind | void | send_now. Returns { ok, recipients } where
-- recipients are the people to email (remind: a fresh link; void: the notice).
create or replace function public.sign_sales_manage(
  _envelope_id uuid, _sales_org_id uuid, _action text, _reason text, _actor_name text, _actor_email text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  e public.sign_envelopes;
  v_ids uuid[];
  v_ok boolean;
begin
  select * into e from public.sign_envelopes where id = _envelope_id;
  if e.id is null or e.origin <> 'sales' or e.sales_org_id is distinct from _sales_org_id then
    raise exception 'That agreement isn''t in this workspace.' using errcode = 'GSN07';
  end if;
  perform set_config('gio.sign_sales_manage', e.id::text, true);
  perform set_config('gio.sign_actor_name', left(btrim(coalesce(_actor_name, '')), 120), true);
  perform set_config('gio.sign_actor_email', lower(btrim(coalesce(_actor_email, ''))), true);

  if _action = 'undo' then
    v_ok := public.sign_undo_send(e.id);
    if v_ok then
      -- Undone sends don't stay as drafts on a deal.
      perform set_config('gio.sign_rpc', 'on', true);
      update public.sign_envelopes set deleted_at = now() where id = e.id and status = 'draft';
    end if;
    return jsonb_build_object('ok', v_ok, 'recipients', '[]'::jsonb);
  elsif _action = 'remind' then
    select array_agg(x.recipient_id) into v_ids from public.sign_remind_request(e.id) x;
  elsif _action = 'void' then
    select array_agg(x.recipient_id) into v_ids from public.sign_void(e.id, _reason) x;
  elsif _action = 'send_now' then
    perform public.sign_send_now(e.id);
  else
    raise exception 'Unknown action.' using errcode = 'GSN07';
  end if;
  return jsonb_build_object('ok', true, 'recipients', to_jsonb(coalesce(v_ids, '{}'::uuid[])));
end;
$function$;

-- ---------------------------------------------------------------------------
-- Tell Gio Sales: every step of a Sales envelope, at commit
-- ---------------------------------------------------------------------------
create or replace function public.sign_sales_snapshot(_envelope_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'envelope_id', e.id,
    'public_id', e.public_id,
    'org_id', e.sales_org_id,
    'deal_id', e.source_id,
    'company_id', e.sales_company_id,
    'title', e.title,
    'status', e.status,
    'sender_name', e.sender_name,
    'sender_email', e.sender_email,
    'sender_sales_user_id', e.sender_sales_user_id,
    'signers_total', (select count(*) from public.sign_recipients r where r.envelope_id = e.id and r.removed_at is null and r.role <> 'cc'),
    'signers_done', (select count(*) from public.sign_recipients r where r.envelope_id = e.id and r.removed_at is null and r.role <> 'cc' and r.status in ('signed', 'approved')),
    'next_signer_name', (select r.name from public.sign_recipients r where r.envelope_id = e.id and r.removed_at is null and r.role <> 'cc' and r.status in ('sent', 'viewed') order by r.position limit 1),
    'reason', coalesce(e.void_reason, (select r.decline_reason from public.sign_recipients r where r.envelope_id = e.id and r.status = 'declined' limit 1)),
    'sent_at', e.sent_at,
    'expires_at', e.expires_at,
    'completed_at', e.completed_at,
    'sealed', e.sealed_path is not null,
    'deleted', e.deleted_at is not null
  )
  from public.sign_envelopes e where e.id = _envelope_id;
$function$;

create or replace function public.sign_events_to_sales()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_snap jsonb;
begin
  if new.kind in ('consented', 'code_sent', 'code_failed', 'opened', 'seal_failed', 'preserved') then
    return null;
  end if;
  if not exists (select 1 from public.sign_envelopes e where e.id = new.envelope_id and e.origin = 'sales') then
    return null;
  end if;
  v_snap := public.sign_sales_snapshot(new.envelope_id);
  insert into public.integration_outbox (tenant_id, target, event, payload, idempotency_key)
  values (
    new.tenant_id, 'gio_sales', 'sign.' || new.kind,
    v_snap || jsonb_build_object(
      'event', 'sign.' || new.kind,
      'event_label', new.label,
      'event_at', new.created_at,
      'event_actor', new.actor_name,
      'event_recipient_id', new.recipient_id,
      'idempotency_key', 'sign_' || new.id),
    'sign_' || new.id)
  on conflict (idempotency_key) do nothing;
  return null;
end;
$function$;

-- At commit, so the snapshot shows the finished step (the last signature
-- arrives with the envelope already completed).
create constraint trigger sign_events_z_to_sales
  after insert on public.sign_events
  deferrable initially deferred
  for each row execute function public.sign_events_to_sales();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.sign_send_sales(uuid, uuid, uuid, uuid, text, uuid, text, text, jsonb, jsonb, timestamptz, text, text),
  public.sign_sales_manage(uuid, uuid, text, text, text, text),
  public.sign_sales_snapshot(uuid),
  public.sign_events_to_sales()
  from public, anon, authenticated;
grant execute on function
  public.sign_send_sales(uuid, uuid, uuid, uuid, text, uuid, text, text, jsonb, jsonb, timestamptz, text, text),
  public.sign_sales_manage(uuid, uuid, text, text, text, text),
  public.sign_sales_snapshot(uuid)
  to service_role;
