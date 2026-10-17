-- Offer approvals: tell the approvers (Allan, 2026-10-17)
--
-- When an offer goes for approval, each approver whose turn it is gets a bell
-- notification right away and an email within a minute. In a sequential
-- chain that's the next pending step; in a parallel chain, every pending
-- step. The chain's rules decide: notifyChain off sends nothing; remind24h on
-- emails a reminder once after a day without a decision.
--
-- 1. offer_approval_notices: one row per approver per turn (and per
--    reminder), the email outbox. Service role only.
-- 2. offer_approval_sync(request): works out whose turn it is, queues their
--    notice and rings their bell once; notices that no longer apply (decided,
--    recalled, declined) are cancelled before they go out.
-- 3. Triggers on requests and steps call it, so it works however the steps
--    are written (today the browser writes them directly).
-- 4. offer_approval_queue_reminders(), offer_approval_claim_notices(),
--    offer_approval_finish_notice(): the minute job's side, used by the
--    offer-approval-notify Edge Function (x-internal-secret).

-- ---- 1. The outbox --------------------------------------------------------
create table public.offer_approval_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  request_id uuid not null,
  step_id uuid not null,
  approver_user_id uuid not null,
  kind text not null check (kind in ('turn', 'reminder')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  attempts smallint not null default 0,
  error text check (error is null or length(error) <= 500),
  unique (step_id, kind)
);
create index offer_approval_notices_due on public.offer_approval_notices (created_at)
  where sent_at is null and cancelled_at is null;
create index offer_approval_notices_request on public.offer_approval_notices (request_id);
alter table public.offer_approval_notices enable row level security;
-- No policies: only the service role and the functions below touch it.
revoke all on public.offer_approval_notices from anon, authenticated;
grant all on public.offer_approval_notices to service_role;
comment on table public.offer_approval_notices is
  'Approval emails owed to approvers (one per turn, one reminder). Written by offer_approval_sync, sent by offer-approval-notify.';

-- ---- 2. Whose turn it is ---------------------------------------------------
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
        '/jobs/' || q.job_id || '?candidate=' || q.candidate_id || '&tab=offer',
        jsonb_build_object('event', 'approval_requested', 'request_id', q.id, 'step_id', s.id));
    end if;
    v_new := null;
  end loop;
end;
$$;
revoke all on function public.offer_approval_sync(uuid) from public, anon, authenticated;

-- ---- 3. Triggers -----------------------------------------------------------
create or replace function public.offer_approval_steps_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r uuid;
begin
  for r in select distinct request_id from new_steps loop
    perform public.offer_approval_sync(r);
  end loop;
  return null;
end;
$$;

create or replace function public.offer_approval_step_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.offer_approval_sync(new.request_id);
  return null;
end;
$$;

create or replace function public.offer_approval_request_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.offer_approval_sync(new.id);
  return null;
end;
$$;

create trigger offer_approval_steps_z_notify_insert
  after insert on public.offer_approval_request_steps
  referencing new table as new_steps
  for each statement execute function public.offer_approval_steps_inserted();
create trigger offer_approval_steps_z_notify_update
  after update of status on public.offer_approval_request_steps
  for each row when (old.status is distinct from new.status)
  execute function public.offer_approval_step_changed();
create trigger offer_approval_requests_z_notify
  after update of status, current_step_order on public.offer_approval_requests
  for each row when (old.status is distinct from new.status or old.current_step_order is distinct from new.current_step_order)
  execute function public.offer_approval_request_changed();

-- ---- 4. The minute job's side ------------------------------------------------
-- One reminder per step, a day after its turn email, while still undecided.
create or replace function public.offer_approval_queue_reminders()
returns int
language sql
security definer
set search_path = public
as $$
  with due as (
    insert into public.offer_approval_notices (tenant_id, request_id, step_id, approver_user_id, kind)
    select n.tenant_id, n.request_id, n.step_id, n.approver_user_id, 'reminder'
    from public.offer_approval_notices n
    join public.offer_approval_request_steps st on st.id = n.step_id and st.status = 'pending'
    join public.offer_approval_requests q on q.id = n.request_id and q.status = 'pending'
    left join public.offer_approval_chains c on c.job_id = q.job_id
    where n.kind = 'turn' and n.sent_at is not null and n.sent_at <= now() - interval '24 hours'
      and coalesce((c.rules->>'remind24h')::boolean, true)
      and coalesce((c.rules->>'notifyChain')::boolean, true)
    on conflict (step_id, kind) do nothing
    returning 1
  )
  select count(*)::int from due;
$$;

-- Notices to email now, with everything the email needs. A notice whose
-- step has been decided is cancelled instead of returned.
create or replace function public.offer_approval_claim_notices(_limit int default 50)
returns table (
  notice_id uuid, kind text, approver_email text, approver_name text, wants_email boolean,
  candidate_name text, job_title text, job_id uuid, candidate_id uuid, requested_by_name text, company text)
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
             t.name::text
      from public.offer_approval_requests q
      join auth.users u on u.id = n.approver_user_id
      left join public.profiles p on p.user_id = n.approver_user_id
      left join public.notification_preferences np on np.user_id = n.approver_user_id
      left join public.candidates c on c.id = q.candidate_id
      left join public.jobs j on j.id = q.job_id
      left join public.profiles rp on rp.user_id = q.requested_by
      left join public.tenants t on t.id = n.tenant_id
      where q.id = n.request_id;
  end loop;
end;
$$;

create or replace function public.offer_approval_finish_notice(_id uuid, _ok boolean, _error text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.offer_approval_notices
     set sent_at = case when _ok then now() end,
         claimed_at = case when _ok then claimed_at end,
         error = case when _ok then null else left(coalesce(_error, 'failed'), 500) end
   where id = _id and sent_at is null;
$$;

revoke all on function public.offer_approval_queue_reminders(), public.offer_approval_claim_notices(int),
  public.offer_approval_finish_notice(uuid, boolean, text), public.offer_approval_steps_inserted(),
  public.offer_approval_step_changed(), public.offer_approval_request_changed() from public, anon, authenticated;
grant execute on function public.offer_approval_queue_reminders(), public.offer_approval_claim_notices(int),
  public.offer_approval_finish_notice(uuid, boolean, text) to service_role;

-- Every minute: queue reminders, then call the sender only when there's mail.
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
  where exists (select 1 from public.offer_approval_notices where sent_at is null and cancelled_at is null and attempts < 5);
  $cmd$
);
