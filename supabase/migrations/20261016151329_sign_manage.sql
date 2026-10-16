-- Gio Sign, build step 9: looking after an envelope once it's out.
--
-- Senders (and admins) can, from the envelope or the record's Agreements card:
--   * Send now a scheduled envelope (it goes out on the next minute run).
--   * Cancel a schedule and, with Undo, schedule it again (senders too, not
--     only admins: sign_schedule now accepts the envelope's sender).
--   * Send a reminder: a fresh link by email. The previous link keeps
--     working (one generation back), so an older email still opens it.
--   * Correct who signs: change the name or email of anyone who hasn't
--     signed yet and push the expiry out. Changed people get a new link on
--     the next minute run and their old one stops.
--   * Void, with a reason: every link stops; recipients are told (sign-manage).
-- The hourly job (sign-remind) sends automatic reminders on the envelope's
-- cadence, warns the sender 3 days before expiry and expires envelopes.

-- One generation of previous link, so a reminder doesn't break the last email.
alter table public.sign_recipient_secrets
  add column if not exists token_hash_prev text unique;

-- ---------------------------------------------------------------------------
-- Schedule, Send now
-- ---------------------------------------------------------------------------
create or replace function public.sign_schedule(_envelope_id uuid, _at timestamptz)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (public.sign_can_edit_envelope(_envelope_id)
          or (public.sign_can_manage_envelope(_envelope_id)
              and exists (select 1 from public.sign_envelopes where id = _envelope_id and status = 'draft'))) then
    raise exception 'You can''t schedule this envelope.' using errcode = 'GSN07';
  end if;
  if _at <= now() + interval '1 minute' then
    raise exception 'Pick a date and time in the future.' using errcode = 'GSN08';
  end if;
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes set status = 'scheduled', scheduled_at = _at, deleted_at = null, deleted_by = null
   where id = _envelope_id;
  perform public.sign_log(_envelope_id, 'scheduled', 'Scheduled for ' || to_char(_at at time zone 'America/Mexico_City', 'Mon DD, HH24:MI'), true);
end;
$function$;

create or replace function public.sign_send_now(_envelope_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.sign_can_manage_envelope(_envelope_id)
     or not exists (select 1 from public.sign_envelopes where id = _envelope_id and status = 'scheduled') then
    raise exception 'Only a scheduled envelope can be sent now.' using errcode = 'GSN07';
  end if;
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes set status = 'queued', scheduled_at = null, dispatch_at = now() where id = _envelope_id;
  perform public.sign_log(_envelope_id, 'queued', 'Sent early instead of on schedule', true);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Void
-- ---------------------------------------------------------------------------
-- Returns the people who had a link (they're told by sign-manage).
create or replace function public.sign_void(_envelope_id uuid, _reason text)
returns table (recipient_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_reason text := left(btrim(coalesce(_reason, '')), 500);
begin
  if not public.sign_can_manage_envelope(_envelope_id)
     or not exists (select 1 from public.sign_envelopes
                    where id = _envelope_id and status in ('sent', 'queued', 'scheduled')) then
    raise exception 'Only an envelope that hasn''t finished can be voided.' using errcode = 'GSN07';
  end if;
  if length(v_reason) < 3 then
    raise exception 'Say why it''s being voided.' using errcode = 'GSN25';
  end if;
  perform set_config('gio.sign_rpc', 'on', true);
  return query
    select s.recipient_id from public.sign_recipient_secrets s
    join public.sign_recipients r on r.id = s.recipient_id
    where r.envelope_id = _envelope_id and s.token_issued_at is not null
      and r.status not in ('declined');
  update public.sign_envelopes
     set status = 'voided', voided_at = now(), void_reason = v_reason, dispatch_at = null, scheduled_at = null
   where id = _envelope_id;
  update public.sign_recipient_secrets s
     set token_hash = null, token_hash_prev = null, session_hash = null, session_expires_at = null,
         code_hash = null, code_expires_at = null, updated_at = now()
    from public.sign_recipients r
   where r.id = s.recipient_id and r.envelope_id = _envelope_id;
  perform public.sign_log(_envelope_id, 'voided', 'Voided: ' || v_reason, true, jsonb_build_object('reason', v_reason));
end;
$function$;

-- ---------------------------------------------------------------------------
-- Correct
-- ---------------------------------------------------------------------------
-- _people: [{ recipient_id, name, email }] for people who haven't signed.
-- _expires_at: a new expiry (1 to 90 days from now), or null to keep it.
create or replace function public.sign_correct(_envelope_id uuid, _people jsonb, _expires_at timestamptz default null)
returns int
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  e public.sign_envelopes;
  p record;
  r public.sign_recipients;
  v_name text;
  v_email text;
  v_changed int := 0;
  v_dup text;
begin
  select * into e from public.sign_envelopes where id = _envelope_id for update;
  if e.id is null or not public.sign_can_manage_envelope(_envelope_id) or e.status not in ('sent', 'scheduled', 'queued') then
    raise exception 'Only an envelope that hasn''t finished can be corrected.' using errcode = 'GSN07';
  end if;
  if _expires_at is not null and (_expires_at < now() + interval '1 day' or _expires_at > now() + interval '90 days') then
    raise exception 'Pick an expiry between tomorrow and 90 days from now.' using errcode = 'GSN08';
  end if;
  perform set_config('gio.sign_rpc', 'on', true);

  for p in select * from jsonb_to_recordset(coalesce(_people, '[]')) as x(recipient_id uuid, name text, email text) loop
    select * into r from public.sign_recipients where id = p.recipient_id and envelope_id = e.id and removed_at is null for update;
    if r.id is null then
      raise exception 'That person isn''t on this envelope.' using errcode = 'GSN13';
    end if;
    v_name := nullif(btrim(p.name), '');
    v_email := lower(nullif(btrim(p.email), ''));
    if v_name is null or v_email is null or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_name) > 120 then
      raise exception '% needs a name and a valid email.', coalesce(r.label, r.name) using errcode = 'GSN13';
    end if;
    if v_name = r.name and v_email = r.email then
      continue;
    end if;
    if r.status in ('signed', 'approved', 'declined') then
      raise exception '% has already signed and can''t be changed.', r.name using errcode = 'GSN13';
    end if;
    update public.sign_recipients
       set name = v_name, email = v_email, consent_at = null, verified_at = null, viewed_at = null,
           status = case when status = 'viewed' then 'sent'::public.sign_recipient_status else status end,
           user_id = (select m.user_id from public.members m join auth.users u on u.id = m.user_id
                      where m.tenant_id = e.tenant_id and m.user_status = 'active' and lower(u.email) = v_email limit 1)
     where id = r.id;
    -- The old link stops; whoever's turn it is gets a new one on the next minute run.
    update public.sign_recipient_secrets
       set token_hash = null, token_hash_prev = null, token_issued_at = null, session_hash = null, session_expires_at = null,
           code_hash = null, code_expires_at = null, code_attempts = 0, updated_at = now()
     where recipient_id = r.id;
    v_changed := v_changed + 1;
    perform public.sign_log(e.id, 'corrected', r.name || ' replaced by ' || v_name || ' (' || v_email || ')', true,
      jsonb_build_object('recipient_id', r.id, 'from_email', r.email, 'to_email', v_email));
  end loop;

  select string_agg(email, ', ') into v_dup from (
    select email from public.sign_recipients
    where envelope_id = e.id and removed_at is null and role <> 'cc'
    group by email having count(*) > 1) d;
  if v_dup is not null then
    raise exception '% is on more than one signing role.', v_dup using errcode = 'GSN13';
  end if;

  if _expires_at is not null and e.status = 'sent' then
    update public.sign_envelopes set expires_at = _expires_at where id = e.id;
    update public.sign_recipient_secrets s set token_expires_at = _expires_at, updated_at = now()
      from public.sign_recipients rr where rr.id = s.recipient_id and rr.envelope_id = e.id;
    perform public.sign_log(e.id, 'corrected', 'Expiry moved to ' || to_char(_expires_at at time zone 'America/Mexico_City', 'Mon DD, YYYY'), false);
    v_changed := v_changed + 1;
  end if;
  return v_changed;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Reminders
-- ---------------------------------------------------------------------------
-- Manual: who to remind now (the people whose turn it is). At most once an
-- hour per envelope.
create or replace function public.sign_remind_request(_envelope_id uuid)
returns table (recipient_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  e public.sign_envelopes;
begin
  select * into e from public.sign_envelopes where id = _envelope_id for update;
  if e.id is null or not public.sign_can_manage_envelope(_envelope_id) or e.status <> 'sent' then
    raise exception 'Only an envelope that''s out for signature can be reminded.' using errcode = 'GSN07';
  end if;
  if e.last_reminded_at is not null and e.last_reminded_at > now() - interval '1 hour' then
    raise exception 'A reminder went out in the last hour. Try again later.' using errcode = 'GSN26';
  end if;
  perform set_config('gio.sign_rpc', 'on', true);
  update public.sign_envelopes set last_reminded_at = now() where id = e.id;
  return query
    select r.id from public.sign_recipients r
    join public.sign_recipient_secrets s on s.recipient_id = r.id
    where r.envelope_id = e.id and r.removed_at is null and r.role <> 'cc'
      and r.status in ('sent', 'viewed') and s.token_issued_at is not null;
end;
$function$;

-- Automatic: people whose last link is older than the envelope's cadence.
create or replace function public.sign_reminders_due(_limit int default 200)
returns table (recipient_id uuid, envelope_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, e.id
  from public.sign_recipients r
  join public.sign_envelopes e on e.id = r.envelope_id
  join public.sign_recipient_secrets s on s.recipient_id = r.id
  where e.status = 'sent' and e.deleted_at is null and e.reminder_days > 0
    and (e.expires_at is null or e.expires_at > now())
    and r.removed_at is null and r.role <> 'cc' and r.status in ('sent', 'viewed')
    and s.token_issued_at is not null
    and s.token_issued_at < now() - make_interval(days => e.reminder_days)
  order by s.token_issued_at
  limit greatest(1, least(_limit, 500));
$function$;

-- A fresh link for a reminder; the previous one keeps working.
create or replace function public.sign_rotate_link(_recipient_id uuid, _token_hash text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n int;
begin
  update public.sign_recipient_secrets
     set token_hash_prev = token_hash, token_hash = _token_hash, token_issued_at = now(), updated_at = now()
   where recipient_id = _recipient_id and token_hash is not null;
  get diagnostics n = row_count;
  return n > 0;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Expiry
-- ---------------------------------------------------------------------------
create or replace function public.sign_expire_due(_limit int default 200)
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
    select x.id from public.sign_envelopes x
    where x.status = 'sent' and x.expires_at <= now() and x.deleted_at is null
    order by x.expires_at limit greatest(1, least(_limit, 500))
    for update skip locked
  loop
    update public.sign_envelopes set status = 'expired' where id = e.id;
    perform public.sign_log(e.id, 'expired', 'Expired before everyone signed', true);
    envelope_id := e.id;
    return next;
  end loop;
end;
$function$;

-- Envelopes 3 days from expiry whose sender hasn't been warned yet; logs the warning.
create or replace function public.sign_expiring_claim(_limit int default 200)
returns table (envelope_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  e record;
begin
  for e in
    select x.id from public.sign_envelopes x
    where x.status = 'sent' and x.deleted_at is null
      and x.expires_at > now() and x.expires_at <= now() + interval '3 days'
      and not exists (select 1 from public.sign_events v where v.envelope_id = x.id and v.kind = 'expiring')
    order by x.expires_at limit greatest(1, least(_limit, 500))
    for update skip locked
  loop
    perform public.sign_log(e.id, 'expiring', 'Expires in 3 days or less');
    envelope_id := e.id;
    return next;
  end loop;
end;
$function$;

revoke execute on function
  public.sign_send_now(uuid), public.sign_void(uuid, text), public.sign_correct(uuid, jsonb, timestamptz),
  public.sign_remind_request(uuid), public.sign_reminders_due(int), public.sign_rotate_link(uuid, text),
  public.sign_expire_due(int), public.sign_expiring_claim(int)
  from public, anon;
grant execute on function
  public.sign_send_now(uuid), public.sign_void(uuid, text), public.sign_correct(uuid, jsonb, timestamptz),
  public.sign_remind_request(uuid)
  to authenticated;
revoke execute on function
  public.sign_reminders_due(int), public.sign_rotate_link(uuid, text), public.sign_expire_due(int), public.sign_expiring_claim(int)
  from authenticated;
grant execute on function
  public.sign_reminders_due(int), public.sign_rotate_link(uuid, text), public.sign_expire_due(int), public.sign_expiring_claim(int)
  to service_role;

-- Every hour at :07: reminders, expiry warnings, expiry.
select cron.schedule(
  'sign-remind',
  '7 * * * *',
  $cmd$
  select net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/sign-remind',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $cmd$
);
