-- Your queue, step 2 (Allan, Go! 2026-11-14): replies that need you, Snooze and "done today".
--
-- 1. Snooze. A hidden queue row (dashboard_queue_dismissals) gets snoozed_until: empty is
--    hidden for good (as before), a time hides it until then and it comes back by itself.
--
-- 2. Replies. "Reply needed" was any unread candidate email in anyone's mailbox: of 289,
--    112 were calendar answers or automatic replies, 144 had been answered since, and
--    admins saw their teammates' mail. queue_replies() uses the Inbox's own rule instead:
--    your own mailbox only, one row per conversation, waiting when the candidate's last
--    real message (not an automatic one, email_is_automatic) came after your last one, in
--    the last 30 days, and the conversation isn't Done in the Inbox. Answering from Gmail
--    or Gio clears it on the next sync. queue_reply_mark() is the queue's "No reply needed"
--    (and its Undo): the Inbox's Done, for anyone's own mailbox.
--
-- 3. queue_done_today(): what you finished today (Mexico City day): candidates you moved
--    or rejected, scorecards you submitted, emails you sent to candidates, offers you
--    approved or declined, and conversations you marked done.

-- 1. Snooze ------------------------------------------------------------------
alter table public.dashboard_queue_dismissals
  add column if not exists snoozed_until timestamptz;

comment on column public.dashboard_queue_dismissals.snoozed_until is
  'Snoozed until this time (the row comes back then). Null: hidden for good.';

-- 2. Automatic messages --------------------------------------------------------
-- Calendar answers (Accepted, Aceptada, Aceito, Tentative, Invitation, Updated invitation),
-- automatic and out-of-office replies, delivery failures and Completed notices. A declined
-- invitation or a proposed new time is a real message: it usually needs an answer.
create or replace function public.email_is_automatic(_subject text, _from text, _headers jsonb)
returns boolean
language sql
immutable
set search_path = public
as $function$
  select
    coalesce(lower(_headers ->> 'auto-submitted') not in ('', 'no'), false)
    or coalesce(lower(_headers ->> 'Auto-Submitted') not in ('', 'no'), false)
    or coalesce(_headers ? 'x-autoreply' or _headers ? 'X-Autoreply' or _headers ? 'x-autorespond', false)
    or coalesce(lower(_from) ~ '(mailer-daemon|postmaster|calendar-notification)', false)
    or coalesce(btrim(_subject) ~* (
      '^(accepted|aceptad[ao]|aceito|aceite|tentative|tentativ[ao]|provisional'
      || '|tentatively accepted|aceptad[ao] provisionalmente'
      || '|invitation|invitaci[oó]n|convite|updated invitation|invitaci[oó]n actualizada|convite atualizado'
      || '|automatic reply|auto-?reply|autoreply|out of office|fuera de la oficina'
      || '|respuesta autom[aá]tica|resposta autom[aá]tica'
      || '|undeliverable|delivery status notification|mail delivery|no se pudo entregar'
      || '|completed)\s*:'
    ), false);
$function$;

comment on function public.email_is_automatic(text, text, jsonb) is
  'True for calendar answers, automatic replies, delivery failures and Completed notices: messages nobody has to answer.';

-- 3. Replies waiting on you -----------------------------------------------------
create or replace function public.queue_replies(_days int default 30)
returns table (
  thread_id text,
  email_id uuid,
  message_id text,
  candidate_id uuid,
  candidate_name text,
  job_id uuid,
  job_title text,
  subject text,
  received_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in to see your queue' using errcode = 'GQU01';
  end if;

  return query
  with mine as (
    select e.id, e.thread_id, e.direction, e.subject, e.from_address, e.headers,
           e.rfc822_message_id, e.received_at,
           coalesce(e.received_at, e.sent_at, e.created_at) as at
    from public.email_logs e
    where e.user_id = uid
      and e.thread_id is not null
      and coalesce(e.status, '') <> 'failed'
  ),
  t as (
    select m.thread_id,
           max(m.at) filter (where m.direction = 'sent') as last_sent,
           max(m.received_at) filter (
             where m.direction = 'received'
               and not public.email_is_automatic(m.subject, m.from_address, m.headers)
           ) as last_real
    from mine m
    group by m.thread_id
  )
  select b.thread_id, last_msg.id, last_msg.rfc822_message_id,
         b.candidate_id, b.candidate_name, b.job_id, b.job_title,
         coalesce(nullif(btrim(last_msg.subject), ''), b.subject), t.last_real
  from t
  join public.inbox_base(uid) b on b.thread_id = t.thread_id
  join lateral (
    select m.id, m.subject, m.rfc822_message_id
    from mine m
    where m.thread_id = t.thread_id and m.direction = 'received' and m.received_at = t.last_real
    order by m.id
    limit 1
  ) last_msg on true
  where t.last_real is not null
    and (t.last_sent is null or t.last_real > t.last_sent)
    and t.last_real > now() - make_interval(days => greatest(1, least(coalesce(_days, 30), 365)))
    and (b.done_at is null or t.last_real > b.done_at)
  order by t.last_real desc
  limit 100;
end
$function$;

revoke execute on function public.queue_replies(int) from public, anon;
grant execute on function public.queue_replies(int) to authenticated;

comment on function public.queue_replies(int) is
  'Your own conversations with candidates waiting on your reply (the candidate''s last real message came after yours, not Done in the Inbox), newest first. GQU01 when signed out.';

-- "No reply needed" and its Undo: the Inbox's Done, on your own mailbox, for anyone.
create or replace function public.queue_reply_mark(_thread_ids text[], _done boolean)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $function$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'Sign in to see your queue' using errcode = 'GQU01';
  end if;

  insert into public.inbox_thread_state as st (user_id, thread_id, done_at, updated_at)
  select uid, b.thread_id, case when _done then now() end, now()
  from public.inbox_base(uid) b
  where b.thread_id = any (coalesce(_thread_ids, '{}'))
  on conflict (user_id, thread_id) do update set
    done_at = case when _done then now() else null end,
    updated_at = now();
  get diagnostics n = row_count;
  return n;
end
$function$;

revoke execute on function public.queue_reply_mark(text[], boolean) from public, anon;
grant execute on function public.queue_reply_mark(text[], boolean) to authenticated;

-- 4. Done today --------------------------------------------------------------
create or replace function public.queue_done_today()
returns int
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  uid uuid := auth.uid();
  since timestamptz := (public.os_today()::timestamp at time zone 'America/Mexico_City');
  n int;
begin
  if uid is null then
    raise exception 'Sign in to see your queue' using errcode = 'GQU01';
  end if;

  select
    (select count(*) from public.activities a
      where a.user_id = uid
        and a.created_at >= since
        and a.activity_type in ('candidate_stage_changed', 'candidate_status_changed', 'scorecard_submitted', 'candidate_email_sent')
        and coalesce(a.metadata ->> 'external_actor', '') <> 'gio')
    + (select count(*) from public.offer_approval_request_steps s
      where s.approver_user_id = uid and s.decided_at >= since)
    + (select count(*) from public.inbox_thread_state st
      where st.user_id = uid and st.done_at >= since)
  into n;
  return n;
end
$function$;

revoke execute on function public.queue_done_today() from public, anon;
grant execute on function public.queue_done_today() to authenticated;

comment on function public.queue_done_today() is
  'How many things you finished today (Mexico City day): candidates moved or rejected, scorecards submitted, emails sent to candidates, offers decided, conversations marked done.';
