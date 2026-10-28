-- Slack log (Allan, 2026-10-28): see whether Slack automations work, and push
-- a reminder out of its schedule.
--
--   History      slack_automation_history(automation): the last messages of
--                one automation, newest first: when, what started it (an
--                event, the schedule, Send now, Remind, Request scorecard),
--                who it was about, who it reached by name and what didn't
--                reach (Slack's reason), or why it was skipped. Names only,
--                never the message or pay. Admins see every row; a job's
--                Recruiter sees the rows for the jobs they manage.
--   Activity     a message about a candidate that went out (or failed for
--                good) writes one line in the candidate's activity, in the job
--                it was about (slack_deliveries_z_activity); skipped messages
--                don't. Lines about offers follow the offer rule
--                (get_candidate_activities, can_view_job_offers).
--   Send now     slack_send_now(automation, dry): for reminders (approval
--                waiting, scorecard due, profile incomplete) lists who is
--                waiting right now (dry) or sends them all at once, at most
--                once every 10 minutes per automation (GSL05). A manual send
--                counts as their latest reminder, so the schedule goes on
--                from it.
--   Send again   slack_retry_delivery(delivery): a message that didn't go out
--                goes back in the queue.
--
-- Who's waiting is one function, slack_reminders_waiting, shared by the
-- schedule (slack_due_reminders, slack_profile_reminders, now through
-- slack_queue_due) and by Send now, so the two never disagree.

alter table public.slack_automations
  add column if not exists sent_now_at timestamptz,
  add column if not exists sent_now_by uuid;

-- 1. Who may change (and so send, resend or see everything of) an automation.
create or replace function public.slack_can_change(_automation uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((
    select case
      when a.job_id is null or a.event like 'offer.%' then public.slack_is_admin(a.tenant_id)
      else public.slack_is_admin(a.tenant_id) or public.can_manage_job(a.job_id) end
    from public.slack_automations a where a.id = _automation), false);
$function$;
revoke all on function public.slack_can_change(uuid) from public, anon, authenticated;

-- What started a message, from its key.
create or replace function public.slack_delivery_trigger(_key text)
returns text
language sql
immutable
as $function$
  select case
    when _key like 'send_now:%' then 'send_now'
    when _key like 'approval_nudge:%' then 'remind'
    when _key like 'scorecard_request:%' then 'request'
    when _key like 'approval_waiting:%' or _key like 'scorecard_due:%' or _key like 'profile_reminder:%' then 'schedule'
    else 'event' end;
$function$;

-- Wakes the sender at once (the insert trigger does this for new messages).
create or replace function public.slack_kick()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/slack-deliver',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')),
    body := '{"kick": true}'::jsonb);
exception when others then
  raise warning 'slack kick: %', sqlerrm;
end;
$function$;
revoke all on function public.slack_kick() from public, anon, authenticated;

-- 2. Who a reminder is waiting on right now, whatever the schedule says.
--   w_subject  one person's reminder (a step; a candidate, stage and person;
--              a member)
--   w_match    what earlier messages to them carry, for the schedule
--   w_context  the message's context
--   w_started  when the wait began (turn began, interview ended, joined)
create or replace function public.slack_reminders_waiting(_automation uuid)
returns table (w_subject text, w_match jsonb, w_context jsonb, w_started timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  a public.slack_automations;
begin
  select * into a from public.slack_automations where id = _automation;
  if not found then
    return;
  end if;

  if a.event = 'offer.approval_waiting' then
    -- Whose turn it is, on requests still waiting.
    return query
    select s.id::text,
      jsonb_build_object('turn_step_id', s.id),
      jsonb_build_object('request_id', q.id, 'offer_id', q.offer_letter_id, 'candidate_id', q.candidate_id,
        'job_id', q.job_id, 'actor_id', q.requested_by, 'turn_step_id', s.id),
      public.offer_approval_turn_started(s.id)
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
      and public.slack_filter_ok(a.filters, 'client_ids', j.organization_id);

  elsif a.event = 'scorecard.due' then
    -- Each interviewer who still owes a scorecard for an interview that ended
    -- in the last 30 days, once per candidate, stage and person.
    return query
    with b as (
      select bk.id, bk.job_candidate_association_id as assoc, bk.job_hiring_stage_id as stage, bk.job_id,
             bk.candidate_id, bk.scheduled_end, bk.interviewer_id
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
    ), owed as (
      select distinct on (p.assoc, p.stage, p.person) p.*
      from people p
      where public.slack_scorecard_owed(p.assoc, p.stage, p.person)
      order by p.assoc, p.stage, p.person, p.scheduled_end desc
    )
    select o.assoc || ':' || o.stage || ':' || o.person,
      jsonb_build_object('association_id', o.assoc, 'stage_id', o.stage, 'interviewer_user_id', o.person),
      jsonb_build_object('booking_id', o.id, 'association_id', o.assoc, 'stage_id', o.stage,
        'candidate_id', o.candidate_id, 'job_id', o.job_id, 'interviewer_user_id', o.person),
      o.scheduled_end
    from owed o;

  elsif a.event = 'member.profile_incomplete' then
    -- Virgilio's own active people whose profile still misses something, from
    -- the day they joined (their latest activation).
    return query
    select m.id::text,
      jsonb_build_object('member_id', m.id),
      jsonb_build_object('member_id', m.id, 'member_user_id', m.user_id),
      coalesce((select max(x.created_at) from public.activities x
                where x.activity_type = 'member_activated' and x.metadata ->> 'member_id' = m.id::text), m.created_at)
    from public.members m
    where m.tenant_id = a.tenant_id and m.user_status = 'active'
      and m.user_id is not null and m.user_type::text <> 'external'
      and cardinality(public.os_profile_missing(a.tenant_id, m.user_id)) > 0;
  end if;
end;
$function$;
revoke all on function public.slack_reminders_waiting(uuid) from public, anon, authenticated;

-- 3. The schedule: what is due among who's waiting.
--   Approvals and profiles: once the wait is N days old, then every N days.
--   Scorecards: once when the interview has ended, then every N days (or
--   never again without every_days).
-- Any earlier message to the same person counts (Remind, Request, Send now).
create or replace function public.slack_queue_due(_events text[])
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a record;
  w record;
  gap integer;
  leeway interval;
  last_at timestamptz;
  today text := (now() at time zone 'America/Mexico_City')::date::text;
  queued integer := 0;
begin
  for a in
    select sa.id, sa.tenant_id, sa.event, sa.filters
    from public.slack_automations sa
    join public.slack_connections c on c.tenant_id = sa.tenant_id and c.removed_at is null and c.status = 'active'
    where sa.event = any(_events) and sa.is_active and sa.removed_at is null
  loop
    gap := nullif(a.filters ->> 'every_days', '')::integer;
    if a.event = 'member.profile_incomplete' then
      gap := coalesce(gap, 7);
      leeway := interval '2 hours';
    else
      leeway := interval '30 minutes';
    end if;

    for w in select * from public.slack_reminders_waiting(a.id) loop
      select max(d.created_at) into last_at from public.slack_deliveries d
      where d.automation_id = a.id and d.context @> w.w_match;
      if a.event = 'scorecard.due' then
        continue when last_at is not null
          and (gap is null or now() < last_at + make_interval(days => gap) - leeway);
      else
        continue when w.w_started is null or now() < w.w_started + make_interval(days => gap) - leeway;
        continue when last_at is not null and now() < last_at + make_interval(days => gap) - leeway;
      end if;
      insert into public.slack_deliveries (tenant_id, automation_id, event, event_key, context)
      values (a.tenant_id, a.id, a.event,
        case a.event
          when 'offer.approval_waiting' then 'approval_waiting:' || w.w_subject || ':' || today
          when 'scorecard.due' then 'scorecard_due:' || w.w_subject || ':'
            || case when last_at is null then 'first' else today end
          else 'profile_reminder:' || w.w_subject || ':' || today end,
        w.w_context)
      on conflict (automation_id, event_key) do nothing;
      if found then queued := queued + 1; end if;
    end loop;
  end loop;
  return queued;
end;
$function$;
revoke all on function public.slack_queue_due(text[]) from public, anon, authenticated;

create or replace function public.slack_due_reminders()
returns integer
language sql
security definer
set search_path to 'public'
as $function$
  select public.slack_queue_due(array['offer.approval_waiting', 'scorecard.due']);
$function$;
revoke all on function public.slack_due_reminders() from public, anon, authenticated;

create or replace function public.slack_profile_reminders()
returns integer
language sql
security definer
set search_path to 'public'
as $function$
  select public.slack_queue_due(array['member.profile_incomplete']);
$function$;
revoke all on function public.slack_profile_reminders() from public, anon, authenticated;

-- 4. Send now: who's waiting (dry), or send to all of them.
create or replace function public.slack_send_now(_automation uuid, _dry boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a public.slack_automations;
  w record;
  ctx jsonb;
  waiting jsonb := '[]'::jsonb;
  next_at timestamptz;
  stamp bigint := floor(extract(epoch from now()))::bigint;
  n integer := 0;
begin
  select * into a from public.slack_automations where id = _automation and removed_at is null;
  if not found then
    raise exception 'That automation is gone.' using errcode = 'GSL04';
  end if;
  if not public.slack_can_change(a.id) then
    raise exception 'Only admins and the job''s Recruiter send its Slack reminders.' using errcode = 'GSL01';
  end if;
  if a.event not in ('offer.approval_waiting', 'scorecard.due', 'member.profile_incomplete') then
    raise exception 'Only reminders can be sent now.' using errcode = 'GSL04';
  end if;
  if not exists (select 1 from public.slack_connections c
                 where c.tenant_id = a.tenant_id and c.removed_at is null and c.status = 'active') then
    raise exception 'Connect Slack first.' using errcode = 'GSL03';
  end if;
  next_at := a.sent_now_at + interval '10 minutes';

  for w in select * from public.slack_reminders_waiting(a.id) loop
    ctx := public.slack_message_context(w.w_context);
    waiting := waiting || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'to', case a.event
              when 'offer.approval_waiting' then ctx -> 'approvers' -> 0 ->> 'name'
              when 'scorecard.due' then ctx -> 'interviewer' ->> 'name'
              else ctx -> 'member' ->> 'name' end,
      'candidate', ctx -> 'candidate' ->> 'name',
      'job', ctx -> 'job' ->> 'title',
      'stage', ctx ->> 'stage',
      'waiting', ctx ->> 'waiting',
      'progress', ctx ->> 'progress')));
  end loop;

  if _dry then
    return jsonb_build_object('waiting', waiting, 'count', jsonb_array_length(waiting),
      'active', a.is_active, 'next_at', case when next_at > now() then next_at end);
  end if;
  if not a.is_active then
    raise exception 'Turn it on first.' using errcode = 'GSL04';
  end if;
  if next_at > now() then
    raise exception 'These went out a few minutes ago. You can send again in % minutes.',
      greatest(1, ceil(extract(epoch from next_at - now()) / 60)::int) using errcode = 'GSL05';
  end if;

  for w in select * from public.slack_reminders_waiting(a.id) loop
    insert into public.slack_deliveries (tenant_id, automation_id, event, event_key, context)
    values (a.tenant_id, a.id, a.event, 'send_now:' || w.w_subject || ':' || stamp,
      w.w_context || jsonb_build_object('sent_by', auth.uid()))
    on conflict (automation_id, event_key) do nothing;
    if found then n := n + 1; end if;
  end loop;
  update public.slack_automations set sent_now_at = now(), sent_now_by = auth.uid() where id = a.id;
  return jsonb_build_object('queued', n, 'waiting', waiting, 'next_at', now() + interval '10 minutes');
end;
$function$;
revoke all on function public.slack_send_now(uuid, boolean) from public, anon;
grant execute on function public.slack_send_now(uuid, boolean) to authenticated;

-- 5. Send again: a message that didn't go out goes back in the queue.
create or replace function public.slack_retry_delivery(_delivery uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  d public.slack_deliveries;
begin
  select * into d from public.slack_deliveries where id = _delivery for update;
  if not found then
    raise exception 'That message is gone.' using errcode = 'GSL04';
  end if;
  if not public.slack_can_change(d.automation_id) then
    raise exception 'Only admins and the job''s Recruiter send its Slack messages again.' using errcode = 'GSL01';
  end if;
  if d.status <> 'failed' then
    raise exception 'Only a message that didn''t go out can be sent again.' using errcode = 'GSL04';
  end if;
  if not exists (select 1 from public.slack_connections c
                 where c.tenant_id = d.tenant_id and c.removed_at is null and c.status = 'active') then
    raise exception 'Connect Slack first.' using errcode = 'GSL03';
  end if;
  update public.slack_deliveries
  set status = 'queued', attempts = 0, next_attempt_at = now(), claimed_at = null, error = null,
      context = context || jsonb_build_object('resent_by', auth.uid())
  where id = _delivery;
  perform public.slack_kick();
end;
$function$;
revoke all on function public.slack_retry_delivery(uuid) from public, anon;
grant execute on function public.slack_retry_delivery(uuid) to authenticated;

-- 6. History: one automation's last messages, names only.
create or replace function public.slack_automation_history(_automation uuid, _limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  a public.slack_automations;
  admin boolean;
  changer boolean;
  rows_out jsonb;
begin
  select * into a from public.slack_automations where id = _automation;
  if not found then
    raise exception 'That automation is gone.' using errcode = 'GSL04';
  end if;
  admin := public.slack_is_admin(a.tenant_id);
  -- Admins see everything; a job's Recruiter sees their own jobs' rows of a
  -- job or workspace automation (never offers or People).
  if not admin and (a.event like 'offer.%' or a.event like 'member.%' or not public.slack_is_member(a.tenant_id)
                    or (a.job_id is not null and not public.can_manage_job(a.job_id))) then
    raise exception 'You can''t see this automation''s messages.' using errcode = 'GSL01';
  end if;
  changer := public.slack_can_change(a.id);

  select coalesce(jsonb_agg(x.r order by x.at desc), '[]'::jsonb) into rows_out
  from (
    select d.created_at as at, jsonb_build_object(
      'id', d.id,
      'created_at', d.created_at,
      'sent_at', d.sent_at,
      'status', d.status,
      'attempts', d.attempts,
      'next_attempt_at', d.next_attempt_at,
      'error', d.error,
      'trigger', public.slack_delivery_trigger(d.event_key),
      'by', public.slack_person(coalesce(nullif(d.context ->> 'sent_by', ''), nullif(d.context ->> 'resent_by', ''),
              case when public.slack_delivery_trigger(d.event_key) in ('remind', 'request')
                   then nullif(d.context ->> 'actor_id', '') end)::uuid) ->> 'name',
      'candidate_id', nullif(d.context ->> 'candidate_id', ''),
      'candidate', (select coalesce(nullif(trim(c.candidate_name), ''), 'Unnamed candidate')
                    from public.candidates c where c.id = nullif(d.context ->> 'candidate_id', '')::uuid),
      'job_id', nullif(d.context ->> 'job_id', ''),
      'job', (select j.title from public.jobs j where j.id = nullif(d.context ->> 'job_id', '')::uuid),
      'member', public.slack_person(nullif(d.context ->> 'member_user_id', '')::uuid) ->> 'name',
      'recipients', (
        select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'to', r ->> 'to', 'ok', coalesce((r ->> 'ok')::boolean, false), 'problem', r ->> 'problem'))), '[]'::jsonb)
        from jsonb_array_elements(case when jsonb_typeof(d.results) = 'array' then d.results else '[]'::jsonb end) r),
      'can_retry', d.status = 'failed' and changer) as r
    from public.slack_deliveries d
    where d.automation_id = a.id
      and (admin or (d.context ->> 'job_id' ~ '^[0-9a-f-]{36}$'
                     and public.can_manage_job((d.context ->> 'job_id')::uuid)))
    order by d.created_at desc
    limit greatest(1, least(coalesce(_limit, 50), 200))
  ) x;

  return jsonb_build_object(
    'rows', rows_out,
    'can_change', changer,
    'next_send_now', case when a.sent_now_at + interval '10 minutes' > now() then a.sent_now_at + interval '10 minutes' end);
end;
$function$;
revoke all on function public.slack_automation_history(uuid, integer) from public, anon;
grant execute on function public.slack_automation_history(uuid, integer) to authenticated;

-- 7. The candidate's activity: one line per message about them that went out
-- or failed for good; skipped ones stay in the History only.
create or replace function public.slack_deliveries_z_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cand uuid := nullif(new.context ->> 'candidate_id', '')::uuid;
  job uuid := nullif(new.context ->> 'job_id', '')::uuid;
  how text := public.slack_delivery_trigger(new.event_key);
  author uuid;
  reached jsonb;
  problems jsonb;
  a public.slack_automations;
  j record;
begin
  if new.status not in ('sent', 'failed') or old.status is not distinct from new.status then
    return null;
  end if;
  if cand is null or job is null then
    return null;
  end if;
  select id, title, organization_id, tenant_id into j from public.jobs where id = job;
  if not found then
    return null;
  end if;
  select * into a from public.slack_automations where id = new.automation_id;
  select coalesce(jsonb_agg(r ->> 'to') filter (where coalesce((r ->> 'ok')::boolean, false) and r ->> 'problem' is null
                                                  and coalesce(r ->> 'to', '') <> ''), '[]'::jsonb),
         coalesce(jsonb_agg(r ->> 'problem') filter (where r ->> 'problem' is not null), '[]'::jsonb)
  into reached, problems
  from jsonb_array_elements(case when jsonb_typeof(new.results) = 'array' then new.results else '[]'::jsonb end) r;
  author := coalesce(nullif(new.context ->> 'sent_by', ''), nullif(new.context ->> 'resent_by', ''),
    case when how in ('remind', 'request') then nullif(new.context ->> 'actor_id', '') end)::uuid;

  insert into public.activities (activity_type, title, description, entity_type, entity_id, user_id,
    organization_id, tenant_id, metadata)
  values (
    case when new.status = 'sent' then 'automation_triggered'::public.activity_type
         else 'automation_skipped'::public.activity_type end,
    case when new.status = 'sent' then 'Sent to Slack' else 'Slack message didn''t go out' end,
    nullif(concat_ws(' · ',
      case when jsonb_array_length(reached) > 0 then 'To ' || (select string_agg(v, ', ') from jsonb_array_elements_text(reached) v) end,
      case when jsonb_array_length(problems) > 0 then (select string_agg(v, ' ') from jsonb_array_elements_text(problems) v)
           when new.status = 'failed' then new.error end), ''),
    'candidate', cand, coalesce(author, '00000000-0000-0000-0000-000000000000'), j.organization_id, j.tenant_id,
    jsonb_strip_nulls(jsonb_build_object(
      'source', 'slack',
      'job_id', job,
      'job_title', j.title,
      'candidate_id', cand,
      'slack_event', new.event,
      'external_actor', case when author is null then 'gio' end,
      'slack', jsonb_strip_nulls(jsonb_build_object(
        'automation_id', new.automation_id,
        'automation_name', a.name,
        'delivery_id', new.id,
        'status', new.status,
        'trigger', how,
        'reached', reached,
        'problems', problems)))));
  return null;
exception when others then
  -- The log never stands in the way of the send it records.
  raise warning 'slack activity: %', sqlerrm;
  return null;
end;
$function$;
revoke all on function public.slack_deliveries_z_activity() from public, anon, authenticated;
create trigger slack_deliveries_z_activity after update of status on public.slack_deliveries
  for each row execute function public.slack_deliveries_z_activity();

-- 8. Slack lines about offers follow the offer rule, like the offer trail.
CREATE OR REPLACE FUNCTION public.get_candidate_activities(p_candidate_id uuid, p_job_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, user_id uuid, organization_id uuid, activity_type activity_type, title text, description text, metadata jsonb, entity_type text, entity_id uuid, created_at timestamp with time zone, author_first_name text, author_last_name text, author_email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_org_id UUID;
  v_user_type TEXT;
  v_has_access BOOLEAN;
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT c.organization_id INTO v_org_id FROM public.candidates c WHERE c.id = p_candidate_id;
  IF v_org_id IS NULL THEN
    SELECT j.organization_id INTO v_org_id
    FROM public.job_candidate_associations jca
    JOIN public.jobs j ON j.id = jca.job_id
    WHERE jca.candidate_id = p_candidate_id
    LIMIT 1;
  END IF;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Candidate not found or has no organization: %', p_candidate_id;
  END IF;

  v_user_type := public.get_user_type_secure();
  v_has_access := public.user_has_org_hierarchy_access(v_org_id);
  IF NOT (v_user_type = 'platform_admin' OR v_has_access) THEN
    RAISE EXCEPTION 'Access denied to candidate activities. User: %, Candidate Org: %, User Type: %, Has Access: %',
      v_current_user, v_org_id, v_user_type, v_has_access;
  END IF;

  RETURN QUERY
  WITH matched AS (
    SELECT a.id, a.user_id, a.organization_id, a.activity_type, a.title, a.description,
           a.metadata, a.entity_type, a.entity_id, a.created_at
    FROM public.activities a
    WHERE a.entity_id = p_candidate_id
      AND a.entity_type = 'candidate'
      AND (p_job_id IS NULL OR a.metadata @> jsonb_build_object('job_id', p_job_id::text))
    UNION
    SELECT a.id, a.user_id, a.organization_id, a.activity_type, a.title, a.description,
           a.metadata, a.entity_type, a.entity_id, a.created_at
    FROM public.activities a
    WHERE a.metadata @> jsonb_build_object('candidate_id', p_candidate_id::text)
      AND (p_job_id IS NULL OR a.metadata @> jsonb_build_object('job_id', p_job_id::text))
    UNION
    -- Email activities whose linked email record belongs to the job, even when the
    -- activity metadata itself never recorded job_id.
    SELECT a.id, a.user_id, a.organization_id, a.activity_type, a.title, a.description,
           a.metadata, a.entity_type, a.entity_id, a.created_at
    FROM public.activities a
    JOIN public.email_logs e
      ON e.id::text = a.metadata->>'email_log_id'
    WHERE p_job_id IS NOT NULL
      AND a.entity_id = p_candidate_id
      AND a.entity_type = 'candidate'
      AND a.activity_type IN ('candidate_email_sent','candidate_email_received','candidate_email_automated')
      AND e.candidate_id = p_candidate_id
      AND e.job_id = p_job_id
  )
  SELECT
    m.id, m.user_id, m.organization_id, m.activity_type, m.title, m.description,
    m.metadata, m.entity_type, m.entity_id, m.created_at,
    p.first_name AS author_first_name,
    p.last_name AS author_last_name,
    COALESCE(p.email, '') AS author_email
  FROM matched m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE NOT (
      coalesce(m.metadata->>'source', '') = 'offer_trail'
      OR m.activity_type::text ~ '^(offer_|approval_|agreement_)'
      OR (coalesce(m.metadata->>'source', '') = 'slack' AND coalesce(m.metadata->>'slack_event', '') LIKE 'offer.%')
    )
    OR (m.metadata->>'job_id' ~ '^[0-9a-f-]{36}$'
        AND public.can_view_job_offers((m.metadata->>'job_id')::uuid))
  ORDER BY m.created_at DESC;
END;
$function$;
