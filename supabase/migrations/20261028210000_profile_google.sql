-- Google Workspace on My profile (Allan, 2026-10-28): connecting Google is the
-- seventh thing a complete profile has, for Virgilio's own people. It moves
-- out of Settings (Email & calendar is gone) into a card on My profile.
--
--   os_profile_missing   adds 'google' (after 'you'): no Gmail or Calendar
--                        connection, or one that needs reconnecting (off,
--                        expired, error, auth required, or a token error),
--                        the same rule as the card's "Reconnect required"
--                        (os_google_broken; hasTokenFailure in the app)
--   slack_message_context   a profile reminder's {progress} is "N of 7 done"
--
-- Kept in step with useProfileChecks (src/components/os/profileChecks.ts) and
-- the Slack reminder's labels and card (MISSING_LABEL / MISSING_CARD in
-- supabase/functions/_shared/slack.ts). The People & Access dashboard keeps
-- its own count of complete profiles (country, tax ID, bank).

-- When a Google connection needs reconnecting.
create or replace function public.os_google_broken(_active boolean, _status text, _message text)
returns boolean
language sql
immutable
as $function$
  select _active is false
    or lower(coalesce(_status, '')) in ('expired', 'error', 'auth_required')
    or lower(coalesce(_message, '')) ~ '(token|revoked|refresh|invalid_grant)';
$function$;

create or replace function public.os_profile_missing(_tenant uuid, _user uuid)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $function$
  select array_remove(array[
    case when coalesce(p.avatar_url, '') = '' or coalesce(btrim(p.title), '') = '' then 'you' end,
    case when not exists (select 1 from public.user_mail_identities u where u.user_id = _user)
              and not exists (select 1 from public.calendar_identities c where c.user_id = _user)
           or exists (select 1 from public.user_mail_identities u
                      where u.user_id = _user and public.os_google_broken(u.is_active, u.sync_status, u.sync_error))
           or exists (select 1 from public.calendar_identities c
                      where c.user_id = _user and public.os_google_broken(c.is_active, c.sync_status, c.sync_error_message))
         then 'google' end,
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

-- A profile reminder's progress counts seven things.
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
      'progress', (7 - cardinality(miss)) || ' of 7 done',
      'link', '/me');
  end if;
  return res;
end;
$function$;
revoke all on function public.slack_message_context(jsonb) from public, anon, authenticated;
