-- Slack: "Offer approver" for "An offer needs approval" (Allan, 2026-10-28).
--
-- A new Send to option, the role `approver`, DMs the person whose turn it is
-- in the offer's approval chain, one at a time: approver 1 when the request
-- goes out, approver 2 once approver 1 approves, and so on (everyone at once
-- only in a parallel chain, the bell's own rule). A decline or a closed
-- request stops it, and a turn that's over by the time the message would go
-- out is skipped rather than sent late.
--
-- Each turn is its own event (key approval_turn:<step>, so no approver hears
-- twice for a step) and goes only to automations that DM the offer approver,
-- only to that person. The request's own message (key approval_requested:
-- <request>) still goes once to the automation's channels and people, and
-- never to the approver role. The approver role is allowed on "An offer needs
-- approval" only (GSL04). Messages gain {approver} (whose turn it is) and
-- {approval_step} ("Step 2 of 3").
--
-- The chain's "notify approvers" switch is the bell's; choosing Offer approver
-- in a Slack automation is its own choice.

-- 1. Where an event goes.
create or replace function public.slack_emit(_tenant uuid, _event text, _key text, _ctx jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  j record;
  stage_lib uuid;
begin
  if _tenant is null then return; end if;
  if not exists (
    select 1 from public.slack_connections c
    where c.tenant_id = _tenant and c.removed_at is null and c.status = 'active'
  ) then
    return;
  end if;
  select id, department_id, organization_id into j
  from public.jobs where id = nullif(_ctx ->> 'job_id', '')::uuid;
  if nullif(_ctx ->> 'stage_id', '') is not null then
    select h.stage_id into stage_lib from public.job_hiring_stages h where h.id = (_ctx ->> 'stage_id')::uuid;
  end if;

  insert into public.slack_deliveries (tenant_id, automation_id, event, event_key, context)
  select _tenant, a.id, _event, _key, _ctx
  from public.slack_automations a
  where a.tenant_id = _tenant
    and a.event = _event
    and a.is_active
    and a.removed_at is null
    and (a.job_id is null or a.job_id = j.id)
    and public.slack_filter_ok(a.filters, 'job_ids', j.id)
    and public.slack_filter_ok(a.filters, 'department_ids', j.department_id)
    and public.slack_filter_ok(a.filters, 'client_ids', j.organization_id)
    and public.slack_filter_ok(a.filters, 'stage_ids', stage_lib)
    -- An approver's turn goes only to automations that DM the offer approver;
    -- everything else goes to automations with somewhere else to send it.
    and exists (
      select 1 from jsonb_array_elements(a.destinations) x
      where ((x ->> 'type' = 'role' and x ->> 'role' = 'approver') = (_ctx ? 'turn_step_id')))
  on conflict (automation_id, event_key) do nothing;
exception when others then
  -- Slack never stands in the way of the change that caused the event.
  raise warning 'slack_emit %: %', _event, sqlerrm;
end;
$function$;
revoke all on function public.slack_emit(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public.slack_check_destinations(_d jsonb)
returns boolean
language sql
immutable
as $function$
  select jsonb_typeof(_d) = 'array'
    and jsonb_array_length(_d) between 1 and 10
    and not exists (
      select 1 from jsonb_array_elements(_d) x
      where not (
        (x ->> 'type' in ('channel', 'user') and coalesce(x ->> 'id', '') ~ '^[CGDUW][A-Z0-9]{4,20}$'
          and char_length(coalesce(x ->> 'name', '')) <= 120)
        or (x ->> 'type' = 'role' and x ->> 'role' in ('recruiter', 'sourcer', 'hiring_manager', 'interviewer', 'approver'))));
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
  if _event <> 'offer.approval_requested' and exists (
    select 1 from jsonb_array_elements(_destinations) x where x ->> 'type' = 'role' and x ->> 'role' = 'approver'
  ) then
    raise exception 'The offer approver only hears when an offer needs approval.' using errcode = 'GSL04';
  end if;
  if not public.slack_check_filters(coalesce(_filters, '{}'::jsonb)) then
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
    values (_tenant, _job, nullif(trim(coalesce(_name, '')), ''), _event, coalesce(_filters, '{}'::jsonb),
      _destinations, _message, coalesce(_is_active, true), _preset, auth.uid(), auth.uid())
    returning id into out_id;
  else
    update public.slack_automations
    set name = nullif(trim(coalesce(_name, '')), ''), event = _event, filters = coalesce(_filters, '{}'::jsonb),
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

-- 2. The turns.
create or replace function public.offer_approval_slack_turns(_request uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  q public.offer_approval_requests;
  t uuid;
  chain_mode text;
  s record;
begin
  select * into q from public.offer_approval_requests where id = _request;
  if q.id is null or q.status is distinct from 'pending' then return; end if;
  -- offer_approval_decide marks the step declined before it closes the
  -- request: nobody after a decline has a turn.
  if exists (select 1 from public.offer_approval_request_steps x
             where x.request_id = q.id and x.status = 'declined') then
    return;
  end if;
  select tenant_id into t from public.jobs where id = q.job_id;
  select coalesce(c.mode, 'sequential') into chain_mode from public.offer_approval_chains c where c.job_id = q.job_id;
  for s in
    select st.id from public.offer_approval_request_steps st
    where st.request_id = q.id and st.status = 'pending'
      and (coalesce(chain_mode, 'sequential') = 'parallel'
           or st.step_order = (select min(x.step_order) from public.offer_approval_request_steps x
                               where x.request_id = q.id and x.status = 'pending'))
  loop
    perform public.slack_emit(t, 'offer.approval_requested', 'approval_turn:' || s.id,
      jsonb_build_object('request_id', q.id, 'offer_id', q.offer_letter_id, 'candidate_id', q.candidate_id,
        'job_id', q.job_id, 'actor_id', q.requested_by, 'turn_step_id', s.id));
  end loop;
exception when others then
  -- Slack never stands in the way of the approval.
  raise warning 'offer_approval_slack_turns: %', sqlerrm;
end;
$function$;
revoke all on function public.offer_approval_slack_turns(uuid) from public, anon, authenticated;

create or replace function public.offer_approval_steps_slack_inserted()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r uuid;
begin
  for r in select distinct request_id from new_steps loop
    perform public.offer_approval_slack_turns(r);
  end loop;
  return null;
end;
$function$;

create or replace function public.offer_approval_steps_slack_changed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.offer_approval_slack_turns(new.request_id);
  return null;
end;
$function$;

create trigger offer_approval_steps_z_slack_insert after insert on public.offer_approval_request_steps
  referencing new table as new_steps
  for each statement execute function public.offer_approval_steps_slack_inserted();
create trigger offer_approval_steps_z_slack_update after update of status on public.offer_approval_request_steps
  for each row when (old.status is distinct from new.status)
  execute function public.offer_approval_steps_slack_changed();

-- 3. What the message says, and never late.
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
  if nullif(_ctx ->> 'scorecard_id', '') is not null then
    res := res || (
      select jsonb_build_object('rating', s.rating::text)
      from public.job_stage_scorecards s where s.id = (_ctx ->> 'scorecard_id')::uuid);
  end if;
  -- An offer approval: whose turn it is (this step's approver when the
  -- message is their turn; else whoever's turn it is now) and "Step 2 of 3".
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
  end if;
  return res;
end;
$function$;
revoke all on function public.slack_message_context(jsonb) from public, anon, authenticated;

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
