-- Offer approval links (Allan, 2026-10-28): the bell, the approval email and
-- Slack all land in the same place. An approver's bell ("Approve the offer
-- for ...", and its reminders) opens the candidate's profile in the job at
-- the approval, scrolled to whose turn it is (?focus=approval); the "offer
-- approved" bell opens the Offer tab. Before, they pointed at the job page
-- with ?candidate=...&tab=offer.
--
-- Only the address changes: each function is its latest version as written,
-- with the new link. The bells already sent move to the new address too.

-- 1. The approver's turn.
create or replace function public.offer_approval_sync(_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.offer_approval_requests;
  v_mode text;
  v_rules jsonb;
  v_ten uuid;
  v_job text;
  v_cand text;
  v_by text;
  v_by_avatar text;
  s record;
  v_new uuid;
begin
  select * into q from public.offer_approval_requests where id = _request_id;
  if q.id is null then
    return;
  end if;

  -- Decided steps, and every step of a request that's over, owe nothing.
  update public.offer_approval_notices n
     set cancelled_at = now()
   where n.request_id = q.id and n.sent_at is null and n.cancelled_at is null
     and (q.status <> 'pending'
          or not exists (select 1 from public.offer_approval_request_steps st
                         where st.id = n.step_id and st.status = 'pending'));
  if q.status <> 'pending' then
    return;
  end if;

  select c.mode, c.rules into v_mode, v_rules from public.offer_approval_chains c where c.job_id = q.job_id;
  if coalesce((v_rules->>'notifyChain')::boolean, true) = false then
    return;
  end if;

  select j.tenant_id, j.title into v_ten, v_job from public.jobs j where j.id = q.job_id;
  if v_ten is null then
    return;
  end if;
  select coalesce(nullif(btrim(c.candidate_name), ''), 'the candidate') into v_cand
  from public.candidates c where c.id = q.candidate_id;
  select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.avatar_url into v_by, v_by_avatar
  from public.profiles p where p.user_id = q.requested_by;

  for s in
    select st.id, st.approver_user_id, st.step_order
    from public.offer_approval_request_steps st
    where st.request_id = q.id and st.status = 'pending'
      and (coalesce(v_mode, 'sequential') = 'parallel'
           or st.step_order = (select min(x.step_order) from public.offer_approval_request_steps x
                               where x.request_id = q.id and x.status = 'pending'))
  loop
    insert into public.offer_approval_notices (tenant_id, request_id, step_id, approver_user_id, kind)
    values (v_ten, q.id, s.id, s.approver_user_id, 'turn')
    on conflict (step_id, kind) do nothing
    returning id into v_new;
    if v_new is not null then
      perform public.emit_notification(
        s.approver_user_id, v_ten, 'offer_event'::public.notification_category,
        q.requested_by, v_by, v_by_avatar,
        'Approve the offer for ' || coalesce(v_cand, 'the candidate'),
        v_job,
        coalesce(v_by, 'A recruiter') || ' sent it for approval. It''s your turn.',
        'offer_letter', q.offer_letter_id, q.job_id, q.candidate_id,
        '/jobs/' || q.job_id || '/candidates/' || q.candidate_id || '?focus=approval',
        jsonb_build_object('event', 'approval_requested', 'request_id', q.id, 'step_id', s.id));
    end if;
    v_new := null;
  end loop;
end;
$$;

-- 2. A reminder from the recruiter.
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
      '/jobs/' || q.job_id || '/candidates/' || q.candidate_id || '?focus=approval',
      jsonb_build_object('event', 'approval_reminder', 'request_id', q.id, 'step_id', s.id));
    v_names := v_names || s.name;
  end loop;

  return jsonb_build_object('reminded', to_jsonb(v_names), 'wait_minutes', v_wait);
end;
$$;

-- 3. Every approver approved: the person who asked.
create or replace function public.offer_approval_announce(_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.offer_approval_requests;
  v_last uuid;
  v_ten uuid;
  v_job text;
  v_cand text;
  v_by text;
  v_by_avatar text;
  v_count int;
  v_new uuid;
begin
  select * into q from public.offer_approval_requests where id = _request_id;
  if q.id is null or q.status <> 'approved' then
    return;
  end if;
  -- Every step decided: none pending or declined, at least one approved.
  if exists (select 1 from public.offer_approval_request_steps st
             where st.request_id = q.id and st.status in ('pending', 'declined')) then
    return;
  end if;
  select count(*) into v_count from public.offer_approval_request_steps st
  where st.request_id = q.id and st.status = 'approved';
  if v_count = 0 then
    return;
  end if;

  -- Who made the last approval: the requester needs no news of their own decision.
  select st.approver_user_id into v_last
  from public.offer_approval_request_steps st
  where st.request_id = q.id and st.status = 'approved'
  order by st.decided_at desc nulls last, st.step_order desc
  limit 1;
  if v_last = q.requested_by then
    return;
  end if;

  select j.tenant_id, j.title into v_ten, v_job from public.jobs j where j.id = q.job_id;
  if v_ten is null then
    return;
  end if;

  insert into public.offer_approval_outcomes (tenant_id, request_id, requester_user_id, last_approver_user_id)
  values (v_ten, q.id, q.requested_by, v_last)
  on conflict (request_id) do nothing
  returning id into v_new;
  if v_new is null then
    return; -- already announced
  end if;

  select coalesce(nullif(btrim(c.candidate_name), ''), 'the candidate') into v_cand
  from public.candidates c where c.id = q.candidate_id;
  select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.avatar_url into v_by, v_by_avatar
  from public.profiles p where p.user_id = v_last;

  perform public.emit_notification(
    q.requested_by, v_ten, 'offer_event'::public.notification_category,
    v_last, v_by, v_by_avatar,
    'Offer approved for ' || coalesce(v_cand, 'the candidate'),
    v_job,
    case when v_count = 1 then 'It''s approved. You can send it for signature.'
         when v_count = 2 then 'Both approvers approved it. You can send it for signature.'
         else 'All ' || v_count || ' approvers approved it. You can send it for signature.' end,
    'offer_letter', q.offer_letter_id, q.job_id, q.candidate_id,
    '/jobs/' || q.job_id || '/candidates/' || q.candidate_id || '?tab=offer',
    jsonb_build_object('event', 'approval_complete', 'request_id', q.id));
end;
$$;

-- 4. Bells already sent.
update public.notifications
   set action_url = '/jobs/' || job_id || '/candidates/' || candidate_id
       || case when metadata->>'event' = 'approval_complete' then '?tab=offer' else '?focus=approval' end
 where action_url = '/jobs/' || job_id || '?candidate=' || candidate_id || '&tab=offer'
   and job_id is not null and candidate_id is not null;
