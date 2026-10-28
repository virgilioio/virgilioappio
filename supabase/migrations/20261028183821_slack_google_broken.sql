-- "Someone's Google stops working" (Allan, 2026-10-28): a Slack DM to the
-- person the moment Gio notices their Google Workspace needs reconnecting
-- (Gmail or Calendar turned off, expired, errored or its token revoked: the
-- same rule as the card's "Reconnect required" and the profile check,
-- os_google_broken), so emails to candidates and their calendar don't sit
-- on hold until the next profile reminder.
--
--   member.google_broken   People event, admins set it up, workspace-wide,
--                          only to the person by DM (destination exactly the
--                          team member), never repeats, Virgilio's own people
--                          only (never external users)
--   google_identities_z_slack   on user_mail_identities and
--                          calendar_identities: when a connection goes from
--                          working to needing a reconnect; once a day per
--                          person (key google_broken:<member>:<day>), so Gmail
--                          and Calendar breaking together send one
--   slack_deliveries_claim skips it ("Google works again") when they
--                          reconnected before it went out

-- 1. The event.
create or replace function public.slack_event_known(_event text)
returns boolean
language sql
immutable
set search_path to 'public'
as $function$
  select _event in (
    'candidate.applied', 'candidate.stage_changed', 'candidate.hired', 'candidate.rejected',
    'interview.scheduled', 'interview.cancelled', 'scorecard.submitted', 'scorecard.due',
    'offer.approval_requested', 'offer.approval_waiting', 'offer.approved', 'offer.sent', 'offer.signed',
    'offer.declined',
    'job.opened', 'job.closed',
    'member.joined', 'member.profile_incomplete', 'member.google_broken');
$function$;

-- 2. Only to the person, by DM; it never repeats (no every_days).
create or replace function public.slack_save_automation(
  _id uuid, _tenant uuid, _job uuid, _name text, _event text, _filters jsonb,
  _destinations jsonb, _message text, _is_active boolean default true, _preset text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cur public.slack_automations;
  out_id uuid;
  f jsonb := coalesce(_filters, '{}'::jsonb);
  how_often text := coalesce(_filters, '{}'::jsonb) ->> 'every_days';
  wrong_repeat boolean;
begin
  if _id is not null then
    select * into cur from public.slack_automations where id = _id and removed_at is null;
    if not found then
      raise exception 'That automation is gone.' using errcode = 'GSL04';
    end if;
    -- The caller must be allowed on the automation as it is and as it will be.
    perform public.slack_check_edit(cur.tenant_id, cur.job_id, cur.event);
    if cur.tenant_id <> _tenant or cur.job_id is distinct from _job then
      raise exception 'An automation stays where it was made.' using errcode = 'GSL04';
    end if;
  end if;
  perform public.slack_check_edit(_tenant, _job, _event);
  if not public.slack_check_destinations(_destinations) then
    raise exception 'Pick between 1 and 10 places to send it.' using errcode = 'GSL04';
  end if;
  if _event not in ('offer.approval_requested', 'offer.approval_waiting') and exists (
    select 1 from jsonb_array_elements(_destinations) x where x ->> 'type' = 'role' and x ->> 'role' = 'approver'
  ) then
    raise exception 'The offer approver only hears about offers waiting for their approval.' using errcode = 'GSL04';
  end if;
  -- People: the member role only on People events; nothing else filters them.
  if _event not like 'member.%' and exists (
    select 1 from jsonb_array_elements(_destinations) x where x ->> 'type' = 'role' and x ->> 'role' = 'member'
  ) then
    raise exception 'The team member is only for People automations.' using errcode = 'GSL04';
  end if;
  if _event like 'member.%' and exists (select 1 from jsonb_object_keys(f) k where k <> 'every_days') then
    raise exception 'People automations have no job, department, client or stage filters.' using errcode = 'GSL04';
  end if;
  -- Reminders go only to the person who has to act, by DM.
  if _event = 'member.profile_incomplete' and _destinations <> '[{"type": "role", "role": "member"}]'::jsonb then
    raise exception 'Profile reminders go only to the team member, by DM.' using errcode = 'GSL04';
  end if;
  if _event = 'member.google_broken' and _destinations <> '[{"type": "role", "role": "member"}]'::jsonb then
    raise exception 'Google alerts go only to the person, by DM.' using errcode = 'GSL04';
  end if;
  if _event = 'offer.approval_waiting' and _destinations <> '[{"type": "role", "role": "approver"}]'::jsonb then
    raise exception 'Approval reminders go only to the approver whose turn it is, by DM.' using errcode = 'GSL04';
  end if;
  if _event = 'scorecard.due' and _destinations <> '[{"type": "role", "role": "interviewer"}]'::jsonb then
    raise exception 'Scorecard reminders go only to the interviewer, by DM.' using errcode = 'GSL04';
  end if;
  if _event = 'offer.approval_waiting' and f ? 'stage_ids' then
    raise exception 'Approval reminders have no stage filter.' using errcode = 'GSL04';
  end if;
  -- How often: profile reminders 3, 5, 7 or 14 days; approval reminders 1, 2
  -- or 3 days; a scorecard 1, 2 or 3 days, or only once (none); nothing else
  -- repeats.
  wrong_repeat := case _event
    when 'member.profile_incomplete' then how_often is null or how_often not in ('3', '5', '7', '14')
    when 'offer.approval_waiting' then how_often is null or how_often not in ('1', '2', '3')
    when 'scorecard.due' then how_often is not null and how_often not in ('1', '2', '3')
    else how_often is not null
  end;
  if wrong_repeat then
    raise exception 'That event doesn''t repeat that way.' using errcode = 'GSL04';
  end if;
  if not public.slack_check_filters(f) then
    raise exception 'The filter isn''t valid.' using errcode = 'GSL04';
  end if;
  if char_length(trim(coalesce(_message, ''))) = 0 or char_length(_message) > 3000 then
    raise exception 'Write a message (up to 3,000 characters).' using errcode = 'GSL04';
  end if;
  -- Offers: never pay. Details are names only; this catches a stray token.
  if _message ~* '\{\s*(salary|pay|compensation|amount|bonus|equity)' then
    raise exception 'Slack messages can''t include pay.' using errcode = 'GSL04';
  end if;

  if _id is null then
    insert into public.slack_automations (tenant_id, job_id, name, event, filters, destinations, message, is_active,
      preset, created_by, updated_by)
    values (_tenant, _job, nullif(trim(coalesce(_name, '')), ''), _event, f,
      _destinations, _message, coalesce(_is_active, true), _preset, auth.uid(), auth.uid())
    returning id into out_id;
  else
    update public.slack_automations
    set name = nullif(trim(coalesce(_name, '')), ''), event = _event, filters = f,
        destinations = _destinations, message = _message, is_active = coalesce(_is_active, is_active),
        updated_by = auth.uid(), updated_at = now(), last_error = null, last_error_at = null
    where id = _id
    returning id into out_id;
  end if;
  return out_id;
end;
$function$;
revoke all on function public.slack_save_automation(uuid, uuid, uuid, text, text, jsonb, jsonb, text, boolean, text) from public, anon;
grant execute on function public.slack_save_automation(uuid, uuid, uuid, text, text, jsonb, jsonb, text, boolean, text) to authenticated;

-- 3. Noticing it.
create or replace function public.google_identities_z_slack()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  broken_now boolean;
  broken_before boolean := false;
  m record;
  today text := (now() at time zone 'America/Mexico_City')::date::text;
begin
  if tg_table_name = 'user_mail_identities' then
    broken_now := public.os_google_broken(new.is_active, new.sync_status, new.sync_error);
    if tg_op = 'UPDATE' then
      broken_before := public.os_google_broken(old.is_active, old.sync_status, old.sync_error);
    end if;
  else
    broken_now := public.os_google_broken(new.is_active, new.sync_status, new.sync_error_message);
    if tg_op = 'UPDATE' then
      broken_before := public.os_google_broken(old.is_active, old.sync_status, old.sync_error_message);
    end if;
  end if;
  if not broken_now or broken_before then
    return null;
  end if;
  for m in
    select mm.id, mm.tenant_id from public.members mm
    where mm.user_id = new.user_id and mm.user_status = 'active' and mm.user_type::text <> 'external'
  loop
    perform public.slack_emit(m.tenant_id, 'member.google_broken', 'google_broken:' || m.id || ':' || today,
      jsonb_build_object('member_id', m.id, 'member_user_id', new.user_id));
  end loop;
  return null;
exception when others then
  -- Slack never stands in the way of the sync that noticed it.
  raise warning 'google slack: %', sqlerrm;
  return null;
end;
$function$;
revoke all on function public.google_identities_z_slack() from public, anon, authenticated;

create trigger user_mail_identities_z_slack after insert or update of is_active, sync_status, sync_error
  on public.user_mail_identities for each row execute function public.google_identities_z_slack();
create trigger calendar_identities_z_slack after insert or update of is_active, sync_status, sync_error_message
  on public.calendar_identities for each row execute function public.google_identities_z_slack();

-- 4. Never late: skipped once Google works again.
create or replace function public.slack_deliveries_claim(_limit int default 25)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  claimed_rows jsonb;
begin
  -- Nothing waits when Slack is gone: skip what can't be sent.
  update public.slack_deliveries d set status = 'skipped', error = 'Slack isn''t connected'
  where d.status in ('queued', 'sending')
    and not exists (select 1 from public.slack_connections c
      where c.tenant_id = d.tenant_id and c.removed_at is null and c.status = 'active');

  -- An approver's turn that's over (they decided, someone declined, the
  -- request closed) is never sent late.
  update public.slack_deliveries d set status = 'skipped', error = 'No longer their turn'
  where d.status in ('queued', 'sending')
    and d.context ? 'turn_step_id'
    and not exists (
      select 1 from public.offer_approval_request_steps s
      join public.offer_approval_requests q on q.id = s.request_id
      where s.id = nullif(d.context ->> 'turn_step_id', '')::uuid
        and s.status = 'pending' and q.status = 'pending');

  -- A scorecard that's in, or a candidate who moved on, needs no reminder.
  update public.slack_deliveries d set status = 'skipped', error = 'Scorecard no longer due'
  where d.status in ('queued', 'sending')
    and d.event = 'scorecard.due'
    and not public.slack_scorecard_owed(nullif(d.context ->> 'association_id', '')::uuid,
      nullif(d.context ->> 'stage_id', '')::uuid, nullif(d.context ->> 'interviewer_user_id', '')::uuid);

  -- People: someone who left hears nothing more, and a profile that is now
  -- complete gets no reminder.
  update public.slack_deliveries d set status = 'skipped', error = 'No longer a team member'
  where d.status in ('queued', 'sending')
    and d.event like 'member.%'
    and not exists (
      select 1 from public.members m
      where m.id = nullif(d.context ->> 'member_id', '')::uuid and m.user_status = 'active');
  update public.slack_deliveries d set status = 'skipped', error = 'Profile complete'
  where d.status in ('queued', 'sending')
    and d.event = 'member.profile_incomplete'
    and cardinality(public.os_profile_missing(d.tenant_id, nullif(d.context ->> 'member_user_id', '')::uuid)) = 0;

  -- Google working again before the alert went out: nothing to say.
  update public.slack_deliveries d set status = 'skipped', error = 'Google works again'
  where d.status in ('queued', 'sending')
    and d.event = 'member.google_broken'
    and not ('google' = any(public.os_profile_missing(d.tenant_id, nullif(d.context ->> 'member_user_id', '')::uuid)));

  with picked as (
    select d.id from public.slack_deliveries d
    where (d.status = 'queued' and d.next_attempt_at <= now())
       or (d.status = 'sending' and d.claimed_at < now() - interval '5 minutes')
    order by d.created_at
    limit greatest(1, least(_limit, 100))
    for update skip locked
  ), claimed as (
    update public.slack_deliveries d
    set status = 'sending', attempts = d.attempts + 1, claimed_at = now()
    from picked where d.id = picked.id
    returning d.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'tenant_id', c.tenant_id,
    'attempts', c.attempts,
    'event', c.event,
    'context', public.slack_message_context(c.context),
    'automation', jsonb_build_object('id', a.id, 'message', a.message, 'destinations', a.destinations, 'job_id', a.job_id),
    'connection', jsonb_build_object(
      'token', extensions.pgp_sym_decrypt(decode(k.token_enc, 'base64'), public.slack_token_key()),
      'team_id', k.team_id, 'bot_user_id', k.bot_user_id))), '[]'::jsonb)
  into claimed_rows
  from claimed c
  join public.slack_automations a on a.id = c.automation_id
  join public.slack_connections k on k.tenant_id = c.tenant_id and k.removed_at is null;
  return claimed_rows;
end;
$function$;
revoke all on function public.slack_deliveries_claim(int) from public, anon, authenticated;
