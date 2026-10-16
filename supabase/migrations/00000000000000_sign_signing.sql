-- Gio Sign, build step 7: what happens when a signer finishes or declines.
--
-- The public signing page (app.gogio.io/s/<token>) talks only to the Edge
-- Functions sign-session and sign-submit, which check the link token, the email
-- code and the session before calling these. Both functions run as the service
-- role; nobody else can call them.
--
-- 1. sign_signer_submit: stores the signer's field values and adopted signature,
--    marks them signed (or approved), records it with IP and browser, opens the
--    next person's turn when signing is in order, and completes the envelope
--    when everyone is done. All or nothing.
-- 2. sign_signer_decline: records the reason and stops the envelope.
--
-- Emails to the next signer, the sender and copy recipients are build step 8;
-- sealing is step 11. Both read the state these functions leave.

-- Is it this person's turn? (In order: everyone before them who signs or
-- approves is done. Copy recipients never take a turn.)
create or replace function public.sign_is_turn(_recipient_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.role <> 'cc'
     and r.status in ('sent', 'viewed')
     and e.status = 'sent'
     and (e.expires_at is null or e.expires_at > now())
     and (not e.ordered or not exists (
           select 1 from public.sign_recipients p
           where p.envelope_id = r.envelope_id and p.removed_at is null and p.role <> 'cc'
             and p.position < r.position and p.status not in ('signed', 'approved')))
  from public.sign_recipients r
  join public.sign_envelopes e on e.id = r.envelope_id
  where r.id = _recipient_id and r.removed_at is null;
$function$;

-- _values: { "<field id>": "text" | true | false } for the signer's own fields.
-- _signature: { kind: 'type'|'draw'|'upload', full_name, initials, font,
--               image_path, initials_image_path } (paths already uploaded by
--               sign-submit to sign-files/{tenant}/envelopes/{envelope}/signatures/).
-- Returns { status: envelope status, next: [recipient ids whose turn it now is] }.
create or replace function public.sign_signer_submit(
  _recipient_id uuid, _values jsonb, _signature jsonb, _ip inet, _ua text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r public.sign_recipients;
  e public.sign_envelopes;
  f record;
  v_val text;
  v_missing text := '';
  v_today text;
  v_needs_sig boolean;
  v_next uuid[] := '{}';
  v_left int;
  v_ua text := left(_ua, 500);
begin
  select * into r from public.sign_recipients where id = _recipient_id and removed_at is null for update;
  if r.id is null or r.envelope_id is null then
    raise exception 'not_found' using errcode = 'GSN20';
  end if;
  select * into e from public.sign_envelopes where id = r.envelope_id for update;
  if r.verified_at is null then
    raise exception 'not_verified' using errcode = 'GSN21';
  end if;
  if not public.sign_is_turn(r.id) then
    raise exception 'not_your_turn' using errcode = 'GSN22';
  end if;

  perform set_config('gio.sign_rpc', 'on', true);
  v_today := to_char(now() at time zone 'America/Mexico_City', 'FMMonth FMDD, YYYY');

  -- Fill each of the signer's fields from what they sent, or from what we know.
  select exists (select 1 from public.sign_fields x
                 where x.recipient_id = r.id and x.removed_at is null and x.type in ('signature', 'initials'))
    into v_needs_sig;
  if v_needs_sig and (_signature is null or coalesce(btrim(_signature->>'full_name'), '') = '') then
    raise exception 'signature_required' using errcode = 'GSN23';
  end if;

  for f in
    select * from public.sign_fields x where x.recipient_id = r.id and x.removed_at is null order by x.page, x.y, x.x
  loop
    v_val := case f.type
      when 'signature' then 'signed'
      when 'initials' then 'signed'
      when 'date' then v_today
      when 'email' then r.email
      when 'name' then nullif(left(btrim(coalesce(_values->>f.id::text, '')), 200), '')
      when 'text' then nullif(left(btrim(coalesce(_values->>f.id::text, '')), 2000), '')
      when 'checkbox' then case when (_values->>f.id::text) = 'true' then 'true' else 'false' end
    end;
    if f.required and (v_val is null or (f.type = 'checkbox' and v_val = 'false')) then
      v_missing := v_missing || f.id::text || ',';
    end if;
    update public.sign_fields set value = v_val, filled_at = now() where id = f.id;
  end loop;
  if v_missing <> '' then
    raise exception 'required_missing:%', rtrim(v_missing, ',') using errcode = 'GSN24';
  end if;

  if v_needs_sig then
    insert into public.sign_signatures (recipient_id, tenant_id, kind, full_name, initials, font, image_path, initials_image_path)
    values (
      r.id, r.tenant_id, _signature->>'kind', left(btrim(_signature->>'full_name'), 120),
      left(btrim(coalesce(nullif(_signature->>'initials', ''), left(_signature->>'full_name', 1))), 4),
      case when _signature->>'kind' = 'type' then _signature->>'font' end,
      nullif(_signature->>'image_path', ''), nullif(_signature->>'initials_image_path', ''));
  end if;

  update public.sign_recipients
     set status = case when r.role = 'approver' then 'approved' else 'signed' end::public.sign_recipient_status,
         signed_at = case when r.role = 'approver' then null else now() end,
         approved_at = case when r.role = 'approver' then now() end,
         signed_ip = _ip, signed_user_agent = v_ua
   where id = r.id;

  insert into public.sign_events (tenant_id, envelope_id, recipient_id, kind, label, key, actor_name, actor_email, ip, user_agent)
  values (r.tenant_id, e.id, r.id,
          case when r.role = 'approver' then 'approved' else 'signed' end,
          case when r.role = 'approver' then 'Approved by ' else 'Signed by ' end || r.name,
          true, r.name, r.email, _ip, v_ua);

  select count(*) into v_left from public.sign_recipients
  where envelope_id = e.id and removed_at is null and role <> 'cc' and status not in ('signed', 'approved');

  if v_left = 0 then
    -- Completion shows on the envelope; the trail's next entry is 'sealed' (step 11).
    update public.sign_envelopes set status = 'completed', completed_at = now() where id = e.id;
    return jsonb_build_object('status', 'completed', 'next', '[]'::jsonb);
  end if;

  -- In order: open the next person's turn (all of the next position, if tied).
  if e.ordered then
    with nxt as (
      select p.id from public.sign_recipients p
      where p.envelope_id = e.id and p.removed_at is null and p.role <> 'cc' and p.status = 'waiting'
        and p.position = (select min(q.position) from public.sign_recipients q
                          where q.envelope_id = e.id and q.removed_at is null and q.role <> 'cc' and q.status = 'waiting'))
    update public.sign_recipients s set status = 'sent' from nxt where s.id = nxt.id;
    select coalesce(array_agg(p.id), '{}') into v_next from public.sign_recipients p
    where p.envelope_id = e.id and p.removed_at is null and p.role <> 'cc' and p.status = 'sent';
  end if;

  return jsonb_build_object('status', 'sent', 'next', to_jsonb(v_next));
end;
$function$;

-- Decline: the envelope stops, the reason is kept, and the sender is told (step 8).
create or replace function public.sign_signer_decline(_recipient_id uuid, _reason text, _ip inet, _ua text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r public.sign_recipients;
  v_reason text := left(btrim(coalesce(_reason, '')), 500);
begin
  select * into r from public.sign_recipients where id = _recipient_id and removed_at is null for update;
  if r.id is null or r.envelope_id is null then
    raise exception 'not_found' using errcode = 'GSN20';
  end if;
  if r.verified_at is null then
    raise exception 'not_verified' using errcode = 'GSN21';
  end if;
  if not public.sign_is_turn(r.id) then
    raise exception 'not_your_turn' using errcode = 'GSN22';
  end if;
  if length(v_reason) < 3 then
    raise exception 'reason_required' using errcode = 'GSN25';
  end if;

  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_recipients
     set status = 'declined', declined_at = now(), decline_reason = v_reason,
         signed_ip = _ip, signed_user_agent = left(_ua, 500)
   where id = r.id;
  update public.sign_envelopes set status = 'declined', declined_at = now() where id = r.envelope_id;
  insert into public.sign_events (tenant_id, envelope_id, recipient_id, kind, label, key, actor_name, actor_email, ip, user_agent, detail)
  values (r.tenant_id, r.envelope_id, r.id, 'declined', 'Declined by ' || r.name, true, r.name, r.email, _ip, left(_ua, 500),
          jsonb_build_object('reason', v_reason));
end;
$function$;

revoke execute on function
  public.sign_is_turn(uuid),
  public.sign_signer_submit(uuid, jsonb, jsonb, inet, text),
  public.sign_signer_decline(uuid, text, inet, text)
  from public, anon, authenticated;
grant execute on function
  public.sign_is_turn(uuid),
  public.sign_signer_submit(uuid, jsonb, jsonb, inet, text),
  public.sign_signer_decline(uuid, text, inet, text)
  to service_role;
