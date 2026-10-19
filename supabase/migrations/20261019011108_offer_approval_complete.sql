-- Offer approvals: tell the person who asked once the whole chain has approved (Allan, 2026-10-19)
--
-- When the last approver approves, the person who sent the offer for approval
-- gets a bell notification (with the approval sound) and an email saying the
-- offer is approved. Only when the entire chain is done: the request is
-- approved and no step is still pending or declined (skipped steps count as
-- done). Once per request, however many times the rows are written after.
-- If the person who asked made the last approval themselves, nothing is sent.
--
-- 1. offer_approval_outcomes: one row per approved request, the email outbox.
--    Service role only.
-- 2. offer_approval_announce(request): checks the chain is complete, writes
--    the outbox row and rings the requester's bell once.
-- 3. Triggers on requests (status becomes approved) and steps (a step is
--    approved or skipped) call it, so the order the browser writes them in
--    doesn't matter.
-- 4. offer_approval_claim_outcomes() / offer_approval_finish_outcome(): the
--    minute job's side, used by offer-approval-notify (x-internal-secret).
--    The minute job also wakes the function when this outbox has mail.

-- ---- 1. The outbox --------------------------------------------------------
create table public.offer_approval_outcomes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  request_id uuid not null unique,
  requester_user_id uuid not null,
  last_approver_user_id uuid,
  kind text not null default 'approved' check (kind in ('approved')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  attempts smallint not null default 0,
  error text check (error is null or length(error) <= 500)
);
create index offer_approval_outcomes_due on public.offer_approval_outcomes (created_at)
  where sent_at is null;
alter table public.offer_approval_outcomes enable row level security;
-- No policies: only the service role and the functions below touch it.
revoke all on public.offer_approval_outcomes from anon, authenticated;
grant all on public.offer_approval_outcomes to service_role;
comment on table public.offer_approval_outcomes is
  'Offer approved emails owed to the person who requested approval (one per request). Written by offer_approval_announce, sent by offer-approval-notify.';

-- ---- 2. The chain is complete ------------------------------------------------
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
    '/jobs/' || q.job_id || '?candidate=' || q.candidate_id || '&tab=offer',
    jsonb_build_object('event', 'approval_complete', 'request_id', q.id));
end;
$$;
revoke all on function public.offer_approval_announce(uuid) from public, anon, authenticated;

-- ---- 3. Triggers -----------------------------------------------------------
create or replace function public.offer_approval_request_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.offer_approval_announce(new.id);
  return null;
end;
$$;

create or replace function public.offer_approval_step_decided()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.offer_approval_announce(new.request_id);
  return null;
end;
$$;
revoke all on function public.offer_approval_request_approved(), public.offer_approval_step_decided()
  from public, anon, authenticated;

create trigger offer_approval_requests_z_announce
  after update of status on public.offer_approval_requests
  for each row when (new.status = 'approved' and old.status is distinct from new.status)
  execute function public.offer_approval_request_approved();
create trigger offer_approval_steps_z_announce
  after update of status on public.offer_approval_request_steps
  for each row when (new.status in ('approved', 'skipped') and old.status is distinct from new.status)
  execute function public.offer_approval_step_decided();

-- ---- 4. The minute job's side ------------------------------------------------
create or replace function public.offer_approval_claim_outcomes(_limit int default 50)
returns table (
  outcome_id uuid, requester_email text, requester_name text, wants_email boolean,
  candidate_name text, job_title text, job_id uuid, candidate_id uuid, company text,
  last_approver_name text, approver_names text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
begin
  for o in
    select x.* from public.offer_approval_outcomes x
    where x.sent_at is null and x.attempts < 5
      and (x.claimed_at is null or x.claimed_at < now() - interval '10 minutes')
    order by x.created_at
    limit greatest(1, least(_limit, 200))
    for update skip locked
  loop
    update public.offer_approval_outcomes set claimed_at = now(), attempts = attempts + 1 where id = o.id;
    return query
      select o.id, lower(u.email)::text,
             coalesce(nullif(btrim(p.first_name), ''), split_part(u.email, '@', 1))::text,
             coalesce(np.offer_event_email, true),
             coalesce(nullif(btrim(c.candidate_name), ''), 'the candidate')::text,
             j.title::text, q.job_id, q.candidate_id, t.name::text,
             coalesce(nullif(btrim(concat_ws(' ', lp.first_name, lp.last_name)), ''), 'An approver')::text,
             array(
               select coalesce(nullif(btrim(concat_ws(' ', ap.first_name, ap.last_name)), ''), split_part(au.email, '@', 1))::text
               from public.offer_approval_request_steps st
               join auth.users au on au.id = st.approver_user_id
               left join public.profiles ap on ap.user_id = st.approver_user_id
               where st.request_id = q.id and st.status = 'approved'
               order by st.step_order)
      from public.offer_approval_requests q
      join auth.users u on u.id = o.requester_user_id
      left join public.profiles p on p.user_id = o.requester_user_id
      left join public.notification_preferences np on np.user_id = o.requester_user_id
      left join public.candidates c on c.id = q.candidate_id
      left join public.jobs j on j.id = q.job_id
      left join public.profiles lp on lp.user_id = o.last_approver_user_id
      left join public.tenants t on t.id = o.tenant_id
      where q.id = o.request_id;
  end loop;
end;
$$;

create or replace function public.offer_approval_finish_outcome(_id uuid, _ok boolean, _error text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.offer_approval_outcomes
     set sent_at = case when _ok then now() end,
         claimed_at = case when _ok then claimed_at end,
         error = case when _ok then null else left(coalesce(_error, 'failed'), 500) end
   where id = _id and sent_at is null;
$$;

revoke all on function public.offer_approval_claim_outcomes(int), public.offer_approval_finish_outcome(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.offer_approval_claim_outcomes(int), public.offer_approval_finish_outcome(uuid, boolean, text)
  to service_role;

-- The minute job: the same as before, and it also wakes the sender for this outbox.
select cron.schedule(
  'offer-approval-notify',
  '* * * * *',
  $cmd$
  select public.offer_approval_queue_reminders();
  select net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/offer-approval-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')
    ),
    body := '{}'::jsonb
  ) as request_id
  where exists (select 1 from public.offer_approval_notices where sent_at is null and cancelled_at is null and attempts < 5)
     or exists (select 1 from public.offer_approval_outcomes where sent_at is null and attempts < 5);
  $cmd$
);
