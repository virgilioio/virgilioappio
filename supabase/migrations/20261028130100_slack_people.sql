-- Slack: People automations for Virgilio's own team (Allan, 2026-10-28).
-- Needs 20261028130000_slack_event_rule (desktop) first: it lets the table take
-- the People events.
--
-- Two events, workspace-wide and set up by admins, for internal members only
-- (never external users):
--   member.joined               once per person, when they accept their invite
--                               (key member_joined:<member>, so never again);
--                               to the team member by DM, and any channel or
--                               person (a welcome in #general).
--   member.profile_incomplete   to the team member only, by DM, every 3, 5, 7 or
--                               14 days (filters.every_days) from the day they
--                               joined, until their profile is complete or
--                               they leave. A daily run (pg_cron
--                               slack-profile-reminders, 16:07 UTC = 10:07
--                               Mexico City) queues who is due; a reminder that
--                               is no longer needed when it would go out is
--                               skipped.
-- What a complete profile has is os_profile_missing(), the same six checks
-- as My profile's To do card (useProfileChecks): photo and title, country and
-- contact, birthday, tax ID, bank details, shipping address. Messages name the
-- missing cards, never anything in them.
--
-- The role `member` (the team member) is only for People events; job pages
-- don't list People automations.

-- 1. What a complete profile has (server only).
create or replace function public.os_profile_missing(_tenant uuid, _user uuid)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $function$
  select array_remove(array[
    case when coalesce(p.avatar_url, '') = '' or coalesce(btrim(p.title), '') = '' then 'you' end,
    case when d.country_code is null or coalesce(btrim(d.personal_email), '') = ''
           or coalesce(btrim(d.personal_phone), '') = '' then 'personal' end,
    case when d.birth_date is null then 'birthday' end,
    case when not exists (select 1 from public.os_person_tax_ids t
                          where t.tenant_id = _tenant and t.user_id = _user and t.removed_at is null) then 'tax' end,
    case when not exists (select 1 from public.os_person_bank b
                          where b.tenant_id = _tenant and b.user_id = _user) then 'bank' end,
    case when coalesce(btrim(s.line1), '') = '' or coalesce(btrim(s.city), '') = ''
           or s.country_code is null then 'shipping' end
  ], null)
  from (select 1) one
  left join public.profiles p on p.user_id = _user
  left join public.os_person_details d on d.tenant_id = _tenant and d.user_id = _user
  left join public.os_person_shipping s on s.tenant_id = _tenant and s.user_id = _user;
$function$;
revoke all on function public.os_profile_missing(uuid, uuid) from public, anon, authenticated;

-- 2. Who may set them up, and what they may hold.
create or replace function public.slack_check_edit(_tenant uuid, _job uuid, _event text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if _job is null then
    if not public.slack_is_admin(_tenant) then
      raise exception 'Only admins set up workspace-wide Slack automations.' using errcode = 'GSL01';
    end if;
  else
    if not exists (select 1 from public.jobs j where j.id = _job and j.tenant_id = _tenant and j.deleted_at is null) then
      raise exception 'That job isn''t in this workspace.' using errcode = 'GSL04';
    end if;
    if not public.can_manage_job(_job) then
      raise exception 'Only admins and the job''s Recruiter set up its Slack automations.' using errcode = 'GSL01';
    end if;
  end if;
  if _event like 'member.%' and _job is not null then
    raise exception 'People automations are for the whole workspace.' using errcode = 'GSL04';
  end if;
  if _event like 'offer.%' and not public.slack_is_admin(_tenant) then
    raise exception 'Only admins send offer events to Slack.' using errcode = 'GSL02';
  end if;
  if not exists (select 1 from public.slack_connections c where c.tenant_id = _tenant and c.removed_at is null) then
    raise exception 'Connect Slack first.' using errcode = 'GSL03';
  end if;
  return true;
end;
$function$;
revoke all on function public.slack_check_edit(uuid, uuid, text) from public, anon;
grant execute on function public.slack_check_edit(uuid, uuid, text) to authenticated;

create or replace function public.slack_check_filters(_f jsonb)
returns boolean
language sql
immutable
as $function$
  select jsonb_typeof(_f) = 'object'
    and not exists (select 1 from jsonb_object_keys(_f) k
      where k not in ('job_ids', 'department_ids', 'client_ids', 'stage_ids', 'every_days'))
    and (not _f ? 'every_days'
      or (jsonb_typeof(_f -> 'every_days') = 'number' and (_f ->> 'every_days') in ('3', '5', '7', '14')))
    and not exists (
      select 1 from jsonb_each(_f) e
      where e.key <> 'every_days' and case
        when jsonb_typeof(e.value) <> 'array' then true
        when jsonb_array_length(e.value) > 200 then true
        else exists (select 1 from jsonb_array_elements_text(e.value) v
          where v !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') end);
$function$;

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
        or (x ->> 'type' = 'role' and x ->> 'role' in ('recruiter', 'sourcer', 'hiring_manager', 'interviewer', 'approver', 'member'))));
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
  -- People: the member role only on People events; a profile reminder goes
  -- only to the member, by DM, every 3, 5, 7 or 14 days; nothing else filters them.
  if _event not like 'member.%' and exists (
    select 1 from jsonb_array_elements(_destinations) x where x ->> 'type' = 'role' and x ->> 'role' = 'member'
  ) then
    raise exception 'The team member is only for People automations.' using errcode = 'GSL04';
  end if;
  if _event = 'member.profile_incomplete' and _destinations <> '[{"type": "role", "role": "member"}]'::jsonb then
    raise exception 'Profile reminders go only to the team member, by DM.' using errcode = 'GSL04';
  end if;
  if _event like 'member.%' and exists (
    select 1 from jsonb_object_keys(coalesce(_filters, '{}'::jsonb)) k where k <> 'every_days'
  ) then
    raise exception 'People automations have no job, department, client or stage filters.' using errcode = 'GSL04';
  end if;
  if (_event = 'member.profile_incomplete') <> coalesce(_filters, '{}'::jsonb) ? 'every_days' then
    raise exception 'Only profile reminders repeat, and they need how often.' using errcode = 'GSL04';
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

-- 3. Someone joins: once, internal members only.
create or replace function public.members_z_slack()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.user_status = 'active'
     and (tg_op = 'INSERT' or old.user_status is distinct from 'active')
     and new.user_id is not null
     and new.user_type::text <> 'external' then
    perform public.slack_emit(new.tenant_id, 'member.joined', 'member_joined:' || new.id,
      jsonb_build_object('member_id', new.id, 'member_user_id', new.user_id));
  end if;
  return null;
end;
$function$;
create trigger members_z_slack after insert or update of user_status on public.members
  for each row execute function public.members_z_slack();

-- 4. Profile reminders: who is due today.
create or replace function public.slack_profile_reminders()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a record;
  m record;
  every integer;
  joined_at timestamptz;
  last_at timestamptz;
  today text := (now() at time zone 'America/Mexico_City')::date::text;
  queued integer := 0;
begin
  for a in
    select sa.id, sa.tenant_id, sa.event, sa.filters
    from public.slack_automations sa
    join public.slack_connections c on c.tenant_id = sa.tenant_id and c.removed_at is null and c.status = 'active'
    where sa.event = 'member.profile_incomplete' and sa.is_active and sa.removed_at is null
  loop
    every := coalesce((a.filters ->> 'every_days')::integer, 7);
    for m in
      select mm.id, mm.user_id, mm.created_at
      from public.members mm
      where mm.tenant_id = a.tenant_id and mm.user_status = 'active'
        and mm.user_id is not null and mm.user_type::text <> 'external'
    loop
      -- From the day they joined (their latest activation), then every N days;
      -- a couple of hours' slack so a daily run never slips a day.
      select coalesce(max(x.created_at), m.created_at) into joined_at
      from public.activities x
      where x.activity_type = 'member_activated' and x.metadata ->> 'member_id' = m.id::text;
      continue when now() < joined_at + make_interval(days => every) - interval '2 hours';
      select max(d.created_at) into last_at
      from public.slack_deliveries d
      where d.automation_id = a.id and d.context ->> 'member_id' = m.id::text;
      continue when last_at is not null and now() < last_at + make_interval(days => every) - interval '2 hours';
      continue when cardinality(public.os_profile_missing(a.tenant_id, m.user_id)) = 0;
      insert into public.slack_deliveries (tenant_id, automation_id, event, event_key, context)
      values (a.tenant_id, a.id, a.event, 'profile_reminder:' || m.id || ':' || today,
        jsonb_build_object('member_id', m.id, 'member_user_id', m.user_id))
      on conflict (automation_id, event_key) do nothing;
      if found then queued := queued + 1; end if;
    end loop;
  end loop;
  return queued;
end;
$function$;
revoke all on function public.slack_profile_reminders() from public, anon, authenticated;

select cron.schedule('slack-profile-reminders', '7 16 * * *', $cmd$select public.slack_profile_reminders()$cmd$);

-- 5. What the message says, and never when it's no longer needed.
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

-- 6. Job pages don't list People automations.
create or replace function public.slack_automations_list(_tenant uuid, _job uuid default null)
returns table (
  id uuid, job_id uuid, job_title text, name text, event text, filters jsonb, destinations jsonb,
  message text, is_active boolean, preset text, created_by_name text, updated_at timestamptz,
  last_sent_at timestamptz, last_error text, last_error_at timestamptz, can_edit boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  admin boolean := public.slack_is_admin(_tenant);
begin
  if not public.slack_is_member(_tenant) then
    raise exception 'You can''t see this workspace''s Slack.' using errcode = 'GSL01';
  end if;
  if _job is not null and not (admin or public.can_manage_job(_job)) then
    raise exception 'Only admins and the job''s Recruiter see its Slack automations.' using errcode = 'GSL01';
  end if;
  return query
  select a.id, a.job_id, j.title, a.name, a.event, a.filters, a.destinations, a.message, a.is_active, a.preset,
    public.slack_person(a.created_by) ->> 'name', a.updated_at, a.last_sent_at, a.last_error, a.last_error_at,
    case
      when a.event like 'offer.%' then admin
      when a.job_id is null then admin
      else admin or public.can_manage_job(a.job_id)
    end
  from public.slack_automations a
  left join public.jobs j on j.id = a.job_id
  where a.tenant_id = _tenant
    and a.removed_at is null
    and (
      (_job is null and (admin or (a.job_id is not null and public.can_manage_job(a.job_id))))
      or (_job is not null and a.event not like 'member.%' and (a.job_id = _job or (a.job_id is null
        and public.slack_filter_ok(a.filters, 'job_ids', _job)
        and public.slack_filter_ok(a.filters, 'department_ids', (select department_id from public.jobs where id = _job))
        and public.slack_filter_ok(a.filters, 'client_ids', (select organization_id from public.jobs where id = _job))))))
  order by (a.job_id is null), a.created_at;
end;
$function$;
revoke all on function public.slack_automations_list(uuid, uuid) from public, anon;
grant execute on function public.slack_automations_list(uuid, uuid) to authenticated;
