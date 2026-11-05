-- Gio Sign: envelopes with no record (Allan, 2026-11-06), part 2 of 2.
--
-- A General (standalone) agreement belongs to the workspace: its source is the workspace
-- itself (source_type 'standalone', source_id = the tenant id). Admins send them from
-- Sign › Envelopes, either from a reusable General template or as a one-off envelope.
--   * A one-off envelope is built as a single-use template (sign_templates.single_use),
--     hidden from every template list, and archived the moment it's sent, so it is never
--     sent twice. The envelope keeps its own copy of the documents, people and fields.
--   * General templates can only use the values every agreement has (today, the sender);
--     sign_save_template already refuses record values and "the job's hiring manager" for
--     any kind but candidate. Every signer is typed when sending, fixed, or the sender.
--   * Who may send: admins (sign_can_send). Who sees one: admins, its sender and its
--     signers (sign_can_view_envelope). Nothing here touches candidates, offers, Slack or
--     Gio Sales: their triggers key on a candidate, an offer or origin 'sales'.
--   * 'standalone' is compared as text, so these functions also run before part 1 commits.

alter table public.sign_templates
  add column if not exists single_use boolean not null default false;

comment on column public.sign_templates.single_use is
  'A one-off General envelope built in the template editor: hidden from template lists and archived when sent (sign_send).';

-- Mark a General template as a one-off envelope (before it is sent).
create or replace function public.sign_template_set_single_use(_template_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  t public.sign_templates;
begin
  select * into t from public.sign_templates where id = _template_id for update;
  if t.id is null or not public.sign_is_admin(t.tenant_id) then
    raise exception 'That template isn''t available.' using errcode = 'GSN10';
  end if;
  if t.kind::text <> 'standalone' or t.archived_at is not null or t.uses > 0 then
    raise exception 'Only a new General agreement can be a one-off envelope.' using errcode = 'GSN17';
  end if;
  update public.sign_templates set single_use = true where id = t.id;
end;
$$;

revoke all on function public.sign_template_set_single_use(uuid) from public, anon;
grant execute on function public.sign_template_set_single_use(uuid) to authenticated;

-- The record a send reads from: a General agreement's record is the workspace.
CREATE OR REPLACE FUNCTION public.sign_record_values(_source_type sign_source, _source_id uuid, _job_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  elsif _source_type::text = 'standalone' then
    -- A General agreement: its record is the workspace, and only the values every
    -- agreement has (today, the sender) are filled in. Every signer is typed or fixed.
    select tn.id into v_ten from public.tenants tn where tn.id = _source_id;
    if v_ten is null then
      raise exception 'That workspace doesn''t exist.' using errcode = 'GSN10';
    end if;
    v_values := '{}'::jsonb;
  else
    raise exception 'Customer agreements are sent from the deal in Gio Sales.' using errcode = 'GSN11';
  end if;

  if _source_type::text in ('ats_offer', 'candidate') then
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
    'kind', case _source_type::text when 'member' then 'member' when 'standalone' then 'standalone' else 'candidate' end,
    'job_id', v_job, 'candidate_id', v_cand, 'offer_id', v_offer,
    'label', v_label,
    'values', jsonb_strip_nulls(v_values),
    'labels', coalesce(v_labels, '{}'::jsonb),
    'person', jsonb_build_object('name', coalesce(v_values->>'name', v_name), 'email', v_email));
end;
$function$;

-- Who fills a role: a General agreement has no record person, so its first signer is typed.
CREATE OR REPLACE FUNCTION public.sign_role_person(_r sign_recipients, _rec jsonb, _first_open uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_src text;
  v_name text;
  v_email text;
begin
  v_src := coalesce(_r.fill_from,
    case when _r.fixed then 'fixed' when _r.id = _first_open then 'record' else 'typed' end);
  if v_src = 'record' and _rec->>'kind' = 'standalone' then
    v_src := 'typed';
  end if;
  if v_src = 'fixed' then
    v_name := _r.name; v_email := _r.email;
  elsif v_src = 'record' then
    v_name := _rec->'person'->>'name'; v_email := _rec->'person'->>'email';
  elsif v_src = 'sender' then
    select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '') into v_name
    from public.profiles p where p.user_id = auth.uid();
    v_email := public.sign_my_email();
    v_name := coalesce(v_name, v_email);
  elsif v_src = 'hiring_manager' then
    select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), lower(u.email)
      into v_name, v_email
    from public.job_assignments a
    join auth.users u on u.id = a.user_id
    left join public.profiles p on p.user_id = a.user_id
    where a.job_id = (_rec->>'job_id')::uuid and a.role = 'hiring_manager' and a.deleted_at is null
    order by a.created_at
    limit 1;
    v_name := coalesce(v_name, v_email);
  end if;
  return jsonb_build_object('source', v_src, 'name', v_name, 'email', v_email);
end;
$function$;

-- Send: a General agreement is titled by its template alone when there's no record name,
-- and a one-off envelope's template is archived once it has gone out.
CREATE OR REPLACE FUNCTION public.sign_send(_template_id uuid, _source_type sign_source, _source_id uuid, _job_id uuid, _people jsonb, _send_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _subject text DEFAULT NULL::text, _body text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    left(t.name || coalesce(' · ' || coalesce(v_values->>'name', rec->>'label'), ''), 200),
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

  -- A one-off envelope's template has done its job: hide it for good.
  if t.single_use then
    update public.sign_templates set archived_at = now() where id = t.id;
  end if;

  return v_env;
end;
$function$;
