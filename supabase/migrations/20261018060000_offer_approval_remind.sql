-- Offer approvals: Remind reminds, and offers already waiting get told (Allan, 2026-10-18)
--
-- The Remind button on an offer's approvals only showed a message; nothing
-- reached the approver. And a request made before the notices went live
-- (20261017201333) never got its turn email or bell: only changes to a
-- request or its steps call offer_approval_sync.
--
-- 1. offer_approval_notices.nudged_by: who pressed Remind. A Remind queues
--    the step's reminder notice again (at most once an hour per step), so the
--    minute job emails it; the automatic reminder a day later stays as it was.
-- 2. offer_approval_remind(request): reminds the approvers whose turn it is
--    (never the person pressing it): queues their email and rings their bell.
--    Any active member who can see the offer may press it.
-- 3. offer_approval_claim_notices_v2: offer_approval_claim_notices plus
--    nudged_by_name, so the email can say who sent the reminder. The
--    offer-approval-notify Edge Function moves to it; the first one stays
--    until nothing calls it.
-- 4. Every pending request is synced once now: approvers still waiting get
--    their turn email (within a minute) and their bell.

-- ---- 1. Who reminded -----------------------------------------------------------
alter table public.offer_approval_notices add column nudged_by uuid;
comment on column public.offer_approval_notices.nudged_by is
  'Who pressed Remind (a reminder notice queued by hand); null for the turn email and the automatic reminder.';

-- ---- 2. Remind -----------------------------------------------------------------
create or replace function public.offer_approval_remind(_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  q public.offer_approval_requests;
  v_mode text;
  v_ten uuid;
  v_job text;
  v_cand text;
  v_by text;
  v_by_avatar text;
  s record;
  n public.offer_approval_notices;
  v_names text[] := '{}';
  v_wait int := 0;
begin
  if v_me is null then
    raise exception 'Sign in to send a reminder.' using errcode = '28000';
  end if;
  select * into q from public.offer_approval_requests where id = _request_id;
  if q.id is null or not public.check_org_hierarchy_role_access(q.organization_id, 'member') then
    raise exception 'This approval request isn''t available.' using errcode = 'GOA01';
  end if;
  if q.status <> 'pending' then
    raise exception 'This offer isn''t waiting for approval any more.' using errcode = 'GOA02';
  end if;

  select c.mode into v_mode from public.offer_approval_chains c where c.job_id = q.job_id;
  select j.tenant_id, j.title into v_ten, v_job from public.jobs j where j.id = q.job_id;
  select coalesce(nullif(btrim(c.candidate_name), ''), 'the candidate') into v_cand
  from public.candidates c where c.id = q.candidate_id;
  select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.avatar_url into v_by, v_by_avatar
  from public.profiles p where p.user_id = v_me;

  for s in
    select st.id, st.approver_user_id,
           coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), split_part(u.email, '@', 1)) as name
    from public.offer_approval_request_steps st
    join auth.users u on u.id = st.approver_user_id
    left join public.profiles p on p.user_id = st.approver_user_id
    where st.request_id = q.id and st.status = 'pending' and st.approver_user_id <> v_me
      and (coalesce(v_mode, 'sequential') = 'parallel'
           or st.step_order = (select min(x.step_order) from public.offer_approval_request_steps x
                               where x.request_id = q.id and x.status = 'pending'))
  loop
    select * into n from public.offer_approval_notices
    where step_id = s.id and kind = 'reminder';
    -- Reminded by hand within the hour: wait.
    if n.id is not null and n.nudged_by is not null and n.cancelled_at is null and n.created_at > now() - interval '1 hour' then
      v_wait := greatest(v_wait, ceil(extract(epoch from (n.created_at + interval '1 hour' - now())) / 60)::int);
      continue;
    end if;
    insert into public.offer_approval_notices (tenant_id, request_id, step_id, approver_user_id, kind, nudged_by)
    values (v_ten, q.id, s.id, s.approver_user_id, 'reminder', v_me)
    on conflict (step_id, kind) do update
      set created_at = now(), claimed_at = null, sent_at = null, cancelled_at = null,
          attempts = 0, error = null, nudged_by = v_me;
    perform public.emit_notification(
      s.approver_user_id, v_ten, 'offer_event'::public.notification_category,
      v_me, v_by, v_by_avatar,
      'Reminder: approve the offer for ' || coalesce(v_cand, 'the candidate'),
      v_job,
      coalesce(v_by, 'A recruiter') || ' reminded you. It''s still waiting for your approval.',
      'offer_letter', q.offer_letter_id, q.job_id, q.candidate_id,
      '/jobs/' || q.job_id || '?candidate=' || q.candidate_id || '&tab=offer',
      jsonb_build_object('event', 'approval_reminder', 'request_id', q.id, 'step_id', s.id));
    v_names := v_names || s.name;
  end loop;

  return jsonb_build_object('reminded', to_jsonb(v_names), 'wait_minutes', v_wait);
end;
$$;
revoke all on function public.offer_approval_remind(uuid) from public, anon;
grant execute on function public.offer_approval_remind(uuid) to authenticated;

-- ---- 3. Claiming, with who reminded --------------------------------------------
create or replace function public.offer_approval_claim_notices_v2(_limit int default 50)
returns table (
  notice_id uuid, kind text, approver_email text, approver_name text, wants_email boolean,
  candidate_name text, job_title text, job_id uuid, candidate_id uuid, requested_by_name text, company text,
  nudged_by_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  n record;
begin
  for n in
    select x.* from public.offer_approval_notices x
    where x.sent_at is null and x.cancelled_at is null and x.attempts < 5
      and (x.claimed_at is null or x.claimed_at < now() - interval '10 minutes')
    order by x.created_at
    limit greatest(1, least(_limit, 200))
    for update skip locked
  loop
    if not exists (
      select 1 from public.offer_approval_request_steps st
      join public.offer_approval_requests q on q.id = st.request_id and q.status = 'pending'
      where st.id = n.step_id and st.status = 'pending') then
      update public.offer_approval_notices set cancelled_at = now() where id = n.id;
      continue;
    end if;
    update public.offer_approval_notices set claimed_at = now(), attempts = attempts + 1 where id = n.id;
    return query
      select n.id, n.kind, lower(u.email)::text,
             coalesce(nullif(btrim(p.first_name), ''), split_part(u.email, '@', 1))::text,
             coalesce(np.offer_event_email, true),
             coalesce(nullif(btrim(c.candidate_name), ''), 'the candidate')::text,
             j.title::text, q.job_id, q.candidate_id,
             coalesce(nullif(btrim(concat_ws(' ', rp.first_name, rp.last_name)), ''), 'A recruiter')::text,
             t.name::text,
             case when n.nudged_by is null then null
                  else coalesce(nullif(btrim(concat_ws(' ', bp.first_name, bp.last_name)), ''), 'A recruiter') end::text
      from public.offer_approval_requests q
      join auth.users u on u.id = n.approver_user_id
      left join public.profiles p on p.user_id = n.approver_user_id
      left join public.notification_preferences np on np.user_id = n.approver_user_id
      left join public.candidates c on c.id = q.candidate_id
      left join public.jobs j on j.id = q.job_id
      left join public.profiles rp on rp.user_id = q.requested_by
      left join public.profiles bp on bp.user_id = n.nudged_by
      left join public.tenants t on t.id = n.tenant_id
      where q.id = n.request_id;
  end loop;
end;
$$;
revoke all on function public.offer_approval_claim_notices_v2(int) from public, anon, authenticated;
grant execute on function public.offer_approval_claim_notices_v2(int) to service_role;

-- ---- 4. Offers already waiting -------------------------------------------------
select public.offer_approval_sync(r.id) from public.offer_approval_requests r where r.status = 'pending';
