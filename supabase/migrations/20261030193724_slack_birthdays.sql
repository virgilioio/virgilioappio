-- "It's someone's birthday" (Allan, 2026-10-30): a People automation that
-- wishes a team member happy birthday in Slack on the day.
--
--   member.birthday       People event: admins set it up, workspace-wide only
--                         (slack_check_edit refuses member.% on a job), to any
--                         channel, Slack people and/or the birthday person by
--                         DM (role member); no filters, never repeats.
--   slack_birthdays()     daily at 15:05 UTC (9:05 Mexico City, pg_cron
--                         slack-birthdays): Virgilio's active people (never
--                         external users, os_active_people) whose birthday is
--                         today, on Mexico City days (os_today); 29 February
--                         is the 28th in other years (os_next_occurrence).
--                         One message per person per year per automation
--                         (key birthday:<member>:<year>).
--   slack_save_automation   a People automation goes only to the team member,
--                         channels or Slack people, never a job's roles.
--   slack_deliveries_claim   also skips a birthday wish still waiting after
--                         its day ("Birthday is over"); someone who left is
--                         already skipped for every People event.
-- The message names the person only: never the year or their age.

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
    'member.joined', 'member.profile_incomplete', 'member.google_broken', 'member.birthday');
$function$;

-- 2. Whose birthday it is today: queued through slack_emit, once a year.
create or replace function public.slack_birthdays()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t record;
  p record;
  today date := public.os_today();
  people integer := 0;
begin
  for t in
    select distinct sa.tenant_id
    from public.slack_automations sa
    join public.slack_connections c on c.tenant_id = sa.tenant_id and c.removed_at is null and c.status = 'active'
    where sa.event = 'member.birthday' and sa.is_active and sa.removed_at is null
  loop
    for p in
      select a.member_id, a.user_id from public.os_active_people(t.tenant_id) a
      where a.birth_date is not null and public.os_next_occurrence(a.birth_date, today) = today
    loop
      perform public.slack_emit(t.tenant_id, 'member.birthday',
        'birthday:' || p.member_id || ':' || extract(year from today)::int,
        jsonb_build_object('member_id', p.member_id, 'member_user_id', p.user_id));
      people := people + 1;
    end loop;
  end loop;
  return people;
end;
$function$;
revoke all on function public.slack_birthdays() from public, anon, authenticated;

select cron.schedule('slack-birthdays', '5 15 * * *', $cmd$select public.slack_birthdays()$cmd$);

-- 3. History: a birthday wish comes from the schedule.
create or replace function public.slack_delivery_trigger(_key text)
returns text
language sql
immutable
as $function$
  select case
    when _key like 'send_now:%' then 'send_now'
    when _key like 'approval_nudge:%' then 'remind'
    when _key like 'scorecard_request:%' then 'request'
    when _key like 'approval_waiting:%' or _key like 'scorecard_due:%' or _key like 'profile_reminder:%'
      or _key like 'birthday:%' then 'schedule'
    else 'event' end;
$function$;

-- 4. People automations: never a job's roles.
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
  -- A People automation goes to the team member, channels or Slack people:
  -- a job's roles have nobody to reach there.
  if _event like 'member.%' and exists (
    select 1 from jsonb_array_elements(_destinations) x where x ->> 'type' = 'role' and x ->> 'role' <> 'member'
  ) then
    raise exception 'People automations go to the team member, channels or Slack people.' using errcode = 'GSL04';
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

-- 5. Never late.
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

  -- A birthday wish is for the day itself: one still waiting the next day
  -- (Slack down all day) is never sent late.
  update public.slack_deliveries d set status = 'skipped', error = 'Birthday is over'
  where d.status in ('queued', 'sending')
    and d.event = 'member.birthday'
    and (d.created_at at time zone 'America/Mexico_City')::date <> public.os_today();

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
