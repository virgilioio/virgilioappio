-- Slack reminders (Allan, 2026-10-28): two events that repeat until what they
-- ask for is done, the way profile reminders do.
--
--   offer.approval_waiting   "An offer is still waiting for approval". Only to
--                            the approver whose turn it is, by DM, every 1, 2
--                            or 3 days (filters.every_days) counted from when
--                            their turn began, until they decide, the turn
--                            moves on or the request closes. Pressing Remind
--                            on the offer sends it at once (key
--                            approval_nudge:<notice>:<time>) and restarts the
--                            count. Admins only, like every offer event.
--   scorecard.due            "A scorecard is due". Only to each interviewer who
--                            still owes one, by DM: once when the interview
--                            ends, then every 1, 2 or 3 days, or never again
--                            (no every_days). Only for stages that require a
--                            scorecard, the email reminders' rule: owed by the
--                            interviewer and attendees of an interview that
--                            ended (not cancelled or a no-show) in the last 30
--                            days, while the candidate is still at that stage
--                            and the job is open. Pressing Request on a
--                            profile sends it at once (request-scorecard calls
--                            slack_scorecard_requested).
--
-- A run every 15 minutes (pg_cron slack-due-reminders) queues what is due; a
-- message that is no longer needed when it would go out is skipped ("No
-- longer their turn", "Scorecard submitted", "Candidate moved on"). Details
-- gain {waiting} ("2 days") and the interviewer who owes the scorecard.

-- 1. The events.
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
    'member.joined', 'member.profile_incomplete');
$function$;

-- 2. What an automation may hold: how often is 1, 2, 3 days (approvals and
-- scorecards) or 3, 5, 7, 14 days (profiles); each event's own rule is in
-- slack_save_automation.
create or replace function public.slack_check_filters(_f jsonb)
returns boolean
language sql
immutable
as $function$
  select jsonb_typeof(_f) = 'object'
    and not exists (select 1 from jsonb_object_keys(_f) k
      where k not in ('job_ids', 'department_ids', 'client_ids', 'stage_ids', 'every_days'))
    and (not _f ? 'every_days'
      or (jsonb_typeof(_f -> 'every_days') = 'number' and (_f ->> 'every_days') in ('1', '2', '3', '5', '7', '14')))
    and not exists (
      select 1 from jsonb_each(_f) e
      where e.key <> 'every_days' and case
        when jsonb_typeof(e.value) <> 'array' then true
        when jsonb_array_length(e.value) > 200 then true
        else exists (select 1 from jsonb_array_elements_text(e.value) v
          where v !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') end);
$function$;

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

-- 3. Helpers: when a turn began, and whether a scorecard is still owed.
create or replace function public.offer_approval_turn_started(_step uuid)
returns timestamptz
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case when coalesce(c.mode, 'sequential') = 'parallel' then q.created_at
    else greatest(q.created_at, (
      select max(x.decided_at) from public.offer_approval_request_steps x
      where x.request_id = s.request_id and x.step_order < s.step_order)) end
  from public.offer_approval_request_steps s
  join public.offer_approval_requests q on q.id = s.request_id
  left join public.offer_approval_chains c on c.job_id = q.job_id
  where s.id = _step;
$function$;
revoke all on function public.offer_approval_turn_started(uuid) from public, anon, authenticated;

create or replace function public.slack_scorecard_owed(_assoc uuid, _stage uuid, _user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
      select 1 from public.job_candidate_associations a
      join public.jobs j on j.id = a.job_id
      where a.id = _assoc and a.current_stage_id = _stage
        and coalesce(a.status, '') not in ('rejected', 'hired') and j.status = 'open')
    and not exists (
      select 1 from public.job_stage_scorecards s
      where s.association_id = _assoc and s.stage_instance_id = _stage and s.created_by = _user
        and s.rating is not null and not coalesce(s.is_ai_draft, false));
$function$;
revoke all on function public.slack_scorecard_owed(uuid, uuid, uuid) from public, anon, authenticated;

-- 4. What is due: approval and scorecard reminders, every 15 minutes.
create or replace function public.slack_due_reminders()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a record;
  r record;
  gap integer;
  last_at timestamptz;
  today text := (now() at time zone 'America/Mexico_City')::date::text;
  queued integer := 0;
begin
  for a in
    select sa.id, sa.tenant_id, sa.job_id, sa.event, sa.filters
    from public.slack_automations sa
    join public.slack_connections c on c.tenant_id = sa.tenant_id and c.removed_at is null and c.status = 'active'
    where sa.event in ('offer.approval_waiting', 'scorecard.due') and sa.is_active and sa.removed_at is null
  loop
    gap := nullif(a.filters ->> 'every_days', '')::integer;

    if a.event = 'offer.approval_waiting' then
      -- Whose turn it is, on requests still waiting, from when the turn began.
      for r in
        select s.id as step_id, q.id as request_id, q.offer_letter_id, q.candidate_id, q.job_id, q.requested_by,
               public.offer_approval_turn_started(s.id) as started
        from public.offer_approval_request_steps s
        join public.offer_approval_requests q on q.id = s.request_id and q.status = 'pending'
        join public.jobs j on j.id = q.job_id and j.tenant_id = a.tenant_id
        left join public.offer_approval_chains ch on ch.job_id = q.job_id
        where s.status = 'pending'
          and not exists (select 1 from public.offer_approval_request_steps x
                          where x.request_id = q.id and x.status = 'declined')
          and (coalesce(ch.mode, 'sequential') = 'parallel'
               or s.step_order = (select min(x.step_order) from public.offer_approval_request_steps x
                                  where x.request_id = q.id and x.status = 'pending'))
          and (a.job_id is null or a.job_id = q.job_id)
          and public.slack_filter_ok(a.filters, 'job_ids', j.id)
          and public.slack_filter_ok(a.filters, 'department_ids', j.department_id)
          and public.slack_filter_ok(a.filters, 'client_ids', j.organization_id)
      loop
        continue when r.started is null or now() < r.started + make_interval(days => gap) - interval '30 minutes';
        select max(d.created_at) into last_at from public.slack_deliveries d
        where d.automation_id = a.id and d.context ->> 'turn_step_id' = r.step_id::text;
        continue when last_at is not null and now() < last_at + make_interval(days => gap) - interval '30 minutes';
        insert into public.slack_deliveries (tenant_id, automation_id, event, event_key, context)
        values (a.tenant_id, a.id, a.event, 'approval_waiting:' || r.step_id || ':' || today,
          jsonb_build_object('request_id', r.request_id, 'offer_id', r.offer_letter_id, 'candidate_id', r.candidate_id,
            'job_id', r.job_id, 'actor_id', r.requested_by, 'turn_step_id', r.step_id))
        on conflict (automation_id, event_key) do nothing;
        if found then queued := queued + 1; end if;
      end loop;

    else
      -- Each interviewer who still owes a scorecard for an interview that
      -- ended in the last 30 days, once per candidate, stage and person.
      for r in
        with b as (
          select bk.id, bk.job_candidate_association_id as assoc, bk.job_hiring_stage_id as stage, bk.job_id,
                 bk.candidate_id, bk.scheduled_end, bk.interviewer_id, h.stage_id as stage_lib,
                 j.department_id, j.organization_id
          from public.scheduled_bookings bk
          join public.job_hiring_stages h on h.id = bk.job_hiring_stage_id and h.require_scorecard
          join public.jobs j on j.id = bk.job_id and j.tenant_id = a.tenant_id
          where coalesce(bk.status, '') not in ('cancelled', 'no_show')
            and bk.scheduled_end <= now() and bk.scheduled_end > now() - interval '30 days'
            and bk.job_candidate_association_id is not null
            and (a.job_id is null or a.job_id = bk.job_id)
            and public.slack_filter_ok(a.filters, 'job_ids', bk.job_id)
            and public.slack_filter_ok(a.filters, 'department_ids', j.department_id)
            and public.slack_filter_ok(a.filters, 'client_ids', j.organization_id)
            and public.slack_filter_ok(a.filters, 'stage_ids', h.stage_id)
        ), people as (
          select b.*, b.interviewer_id as person from b where b.interviewer_id is not null
          union
          select b.*, at.user_id as person from b
          join public.scheduled_booking_attendees at on at.booking_id = b.id where at.user_id is not null
        )
        select distinct on (p.assoc, p.stage, p.person) p.id as booking_id, p.assoc, p.stage, p.job_id,
               p.candidate_id, p.person
        from people p
        where public.slack_scorecard_owed(p.assoc, p.stage, p.person)
        order by p.assoc, p.stage, p.person, p.scheduled_end desc
      loop
        select max(d.created_at) into last_at from public.slack_deliveries d
        where d.automation_id = a.id
          and d.context ->> 'association_id' = r.assoc::text
          and d.context ->> 'stage_id' = r.stage::text
          and d.context ->> 'interviewer_user_id' = r.person::text;
        continue when last_at is not null
          and (gap is null or now() < last_at + make_interval(days => gap) - interval '30 minutes');
        insert into public.slack_deliveries (tenant_id, automation_id, event, event_key, context)
        values (a.tenant_id, a.id, a.event,
          'scorecard_due:' || r.assoc || ':' || r.stage || ':' || r.person || ':'
            || case when last_at is null then 'first' else today end,
          jsonb_build_object('booking_id', r.booking_id, 'association_id', r.assoc, 'stage_id', r.stage,
            'candidate_id', r.candidate_id, 'job_id', r.job_id, 'interviewer_user_id', r.person))
        on conflict (automation_id, event_key) do nothing;
        if found then queued := queued + 1; end if;
      end loop;
    end if;
  end loop;
  return queued;
end;
$function$;
revoke all on function public.slack_due_reminders() from public, anon, authenticated;

select cron.schedule('slack-due-reminders', '*/15 * * * *', $cmd$select public.slack_due_reminders()$cmd$);

-- 5. Remind (an offer) and Request (a scorecard) send at once.
create or replace function public.offer_approval_notices_z_slack()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  q public.offer_approval_requests;
  t uuid;
begin
  if new.kind <> 'reminder' or new.nudged_by is null then return null; end if;
  if tg_op = 'UPDATE' and new.created_at is not distinct from old.created_at then return null; end if;
  select * into q from public.offer_approval_requests where id = new.request_id;
  select tenant_id into t from public.jobs where id = q.job_id;
  perform public.slack_emit(t, 'offer.approval_waiting',
    'approval_nudge:' || new.id || ':' || floor(extract(epoch from new.created_at))::bigint,
    jsonb_build_object('request_id', q.id, 'offer_id', q.offer_letter_id, 'candidate_id', q.candidate_id,
      'job_id', q.job_id, 'actor_id', new.nudged_by, 'turn_step_id', new.step_id));
  return null;
end;
$function$;
create trigger offer_approval_notices_z_slack after insert or update on public.offer_approval_notices
  for each row execute function public.offer_approval_notices_z_slack();

create or replace function public.slack_scorecard_requested(_association uuid, _stage uuid, _users uuid[], _by uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a public.job_candidate_associations;
  t uuid;
  bk uuid;
  u uuid;
  n integer := 0;
begin
  select * into a from public.job_candidate_associations where id = _association;
  select tenant_id into t from public.jobs where id = a.job_id;
  -- Only someone in the workspace asks; their own name goes on it.
  if t is null or _by is null or not exists (
    select 1 from public.members m where m.tenant_id = t and m.user_id = _by and m.user_status = 'active') then
    return 0;
  end if;
  select b.id into bk from public.scheduled_bookings b
  where b.job_candidate_association_id = _association and b.job_hiring_stage_id = _stage
    and coalesce(b.status, '') <> 'cancelled'
  order by b.scheduled_end desc nulls last limit 1;
  foreach u in array coalesce(_users, '{}') loop
    continue when u = _by or not public.slack_scorecard_owed(_association, _stage, u);
    perform public.slack_emit(t, 'scorecard.due',
      'scorecard_request:' || _association || ':' || _stage || ':' || u || ':' || floor(extract(epoch from now()))::bigint,
      jsonb_build_object('booking_id', bk, 'association_id', _association, 'stage_id', _stage,
        'candidate_id', a.candidate_id, 'job_id', a.job_id, 'interviewer_user_id', u, 'actor_id', _by));
    n := n + 1;
  end loop;
  return n;
end;
$function$;
revoke all on function public.slack_scorecard_requested(uuid, uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.slack_scorecard_requested(uuid, uuid, uuid[], uuid) to service_role;

-- 6. What the message says: the interviewer who owes it, and how long an
-- approval has waited.
create or replace function public.slack_message_context(_ctx jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  res jsonb := '{}'::jsonb;
  _job uuid := nullif(_ctx ->> 'job_id', '')::uuid;
  assoc uuid := nullif(_ctx ->> 'association_id', '')::uuid;
  opening record;
  req uuid := nullif(_ctx ->> 'request_id', '')::uuid;
  turn_step uuid := nullif(_ctx ->> 'turn_step_id', '')::uuid;
  chain_mode text;
  cur record;
  member_user uuid := nullif(_ctx ->> 'member_user_id', '')::uuid;
  member_tenant uuid;
  miss text[];
  waited interval;
begin
  res := res || jsonb_build_object('candidate', (
    select jsonb_build_object('id', c.id, 'name', coalesce(nullif(trim(c.candidate_name), ''), 'Unnamed candidate'))
    from public.candidates c where c.id = nullif(_ctx ->> 'candidate_id', '')::uuid));
  res := res || jsonb_build_object('job', (
    select jsonb_build_object('id', j.id, 'title', j.title, 'client', o.name, 'department', d.name)
    from public.jobs j
    left join public.organizations o on o.id = j.organization_id
    left join public.departments d on d.id = j.department_id
    where j.id = _job));
  res := res || jsonb_build_object('stage', (
    select coalesce(nullif(h.custom_stage_name, ''), s.stage_name)
    from public.job_hiring_stages h left join public.job_stages s on s.id = h.stage_id
    where h.id = nullif(_ctx ->> 'stage_id', '')::uuid));
  res := res || jsonb_build_object('from_stage', (
    select coalesce(nullif(h.custom_stage_name, ''), s.stage_name)
    from public.job_hiring_stages h left join public.job_stages s on s.id = h.stage_id
    where h.id = nullif(_ctx ->> 'from_stage_id', '')::uuid));
  res := res || jsonb_build_object('actor',
    case when coalesce((_ctx ->> 'by_gio')::boolean, false) then null
         else public.slack_person(nullif(_ctx ->> 'actor_id', '')::uuid) end);
  res := res || jsonb_build_object('reason', (
    select r.name from public.rejection_reasons r where r.id = nullif(_ctx ->> 'reason_id', '')::uuid));

  -- The job's people; a hire names who it credits.
  select o.req_id, o.sourcer_user_id, o.recruiter_user_id into opening
  from public.job_openings o
  where (assoc is not null and o.hired_association_id = assoc)
     or o.id = nullif(_ctx ->> 'opening_id', '')::uuid
  limit 1;
  res := res || jsonb_build_object(
    'opening', opening.req_id,
    'recruiters', coalesce(
      case when opening.recruiter_user_id is not null then jsonb_build_array(public.slack_person(opening.recruiter_user_id)) end,
      (select jsonb_agg(public.slack_person(a.user_id)) from public.job_assignments a
        where a.job_id = _job and a.role = 'recruiter' and a.deleted_at is null), '[]'::jsonb),
    'sourcers', coalesce(
      case when opening.sourcer_user_id is not null then jsonb_build_array(public.slack_person(opening.sourcer_user_id)) end,
      (select jsonb_agg(public.slack_person(a.user_id)) from public.job_assignments a
        where a.job_id = _job and a.role = 'sourcer' and a.deleted_at is null), '[]'::jsonb),
    'hiring_managers', coalesce(
      (select jsonb_agg(public.slack_person(a.user_id)) from public.job_assignments a
        where a.job_id = _job and a.role = 'hiring_manager' and a.deleted_at is null), '[]'::jsonb));

  if nullif(_ctx ->> 'booking_id', '') is not null then
    res := res || (
      select jsonb_build_object(
        'interviewer', public.slack_person(b.interviewer_id),
        'interview_start', b.scheduled_start,
        'interview_title', b.event_title)
      from public.scheduled_bookings b where b.id = (_ctx ->> 'booking_id')::uuid);
  end if;
  -- A scorecard reminder is for the person who owes it (an attendee too).
  if nullif(_ctx ->> 'interviewer_user_id', '') is not null then
    res := res || jsonb_build_object('interviewer', public.slack_person((_ctx ->> 'interviewer_user_id')::uuid));
  end if;
  if nullif(_ctx ->> 'scorecard_id', '') is not null then
    res := res || (
      select jsonb_build_object('rating', s.rating::text)
      from public.job_stage_scorecards s where s.id = (_ctx ->> 'scorecard_id')::uuid);
  end if;
  -- An offer approval: whose turn it is (this step's approver when the
  -- message is their turn; else whoever's turn it is now), "Step 2 of 3" and,
  -- for a turn, how long it has waited.
  if req is not null then
    select coalesce(c.mode, 'sequential') into chain_mode
    from public.offer_approval_requests q
    left join public.offer_approval_chains c on c.job_id = q.job_id
    where q.id = req;
    select coalesce(jsonb_agg(public.slack_person(s.approver_user_id) order by s.step_order), '[]'::jsonb) as people,
           count(*) as n, min(s.step_order) as step_order
    into cur
    from public.offer_approval_request_steps s
    where s.request_id = req
      and case when turn_step is not null then s.id = turn_step
               else s.status = 'pending'
                 and (chain_mode = 'parallel'
                      or s.step_order = (select min(x.step_order) from public.offer_approval_request_steps x
                                         where x.request_id = req and x.status = 'pending')) end;
    res := res || jsonb_build_object(
      'turn', turn_step is not null,
      'approvers', cur.people,
      'approval_step', case when cur.n = 1 then (
        select 'Step ' || count(*) filter (where x.step_order <= cur.step_order) || ' of ' || count(*)
        from public.offer_approval_request_steps x
        where x.request_id = req and x.status <> 'skipped') end);
    if turn_step is not null then
      waited := now() - public.offer_approval_turn_started(turn_step);
      res := res || jsonb_build_object('waiting', case
        when waited is null then null
        when waited >= interval '2 days' then floor(extract(epoch from waited) / 86400)::int || ' days'
        when waited >= interval '1 day' then '1 day'
        when waited >= interval '2 hours' then floor(extract(epoch from waited) / 3600)::int || ' hours'
        when waited >= interval '1 hour' then '1 hour'
        else 'less than an hour' end);
    end if;
  end if;
  -- People: who it's about, and what their profile still needs (the names of
  -- the cards, never anything in them).
  if member_user is not null then
    select m.tenant_id into member_tenant from public.members m where m.id = nullif(_ctx ->> 'member_id', '')::uuid;
    miss := public.os_profile_missing(member_tenant, member_user);
    res := res || jsonb_build_object(
      'member', public.slack_person(member_user),
      'missing', to_jsonb(miss),
      'progress', (6 - cardinality(miss)) || ' of 6 done',
      'link', '/me');
  end if;
  return res;
end;
$function$;
revoke all on function public.slack_message_context(jsonb) from public, anon, authenticated;

-- 7. Never a reminder that's no longer needed.
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
