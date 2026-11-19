-- Run after 20261114194729_queue_replies_snooze inside a transaction that is rolled back.
-- Replies waiting on you come from your own mailbox only, one row per conversation,
-- leaving out automatic messages and anything you've answered or marked done.
--   someone    an active member (their mailbox)
--   other      another active member (a mailbox someone must never see)
-- Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

create or replace function pg_temp.as_user(_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.as_admin()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
end $$;

create or replace function pg_temp.err_of(_sql text)
returns text
language plpgsql
as $$
begin
  execute _sql;
  return 'none';
exception when others then
  return sqlstate;
end $$;

create or replace function pg_temp.mail(_uid uuid, _tenant uuid, _cand uuid, _thread text, _dir text, _subject text, _hours_ago numeric)
returns void
language plpgsql
as $$
begin
  insert into public.email_logs (user_id, tenant_id, candidate_id, thread_id, direction, subject, from_address, to_addresses, status, received_at, sent_at)
  values (_uid, _tenant, _cand, _thread, _dir, _subject,
          case when _dir = 'received' then 'candidate@example.com' else 'recruiter@example.com' end,
          array['someone@example.com'], case when _dir = 'received' then 'delivered' else 'sent' end,
          case when _dir = 'received' then now() - make_interval(secs => (_hours_ago * 3600)::double precision) end,
          case when _dir = 'sent' then now() - make_interval(secs => (_hours_ago * 3600)::double precision) end);
end $$;

do $$
declare
  someone uuid;
  other uuid;
  tenant uuid;
  cand uuid;
  threads text[];
  n int;
  d0 int;
  d1 int;
  e text;
begin
  select m.user_id, m.tenant_id into someone, tenant from public.members m where m.user_status = 'active' order by m.created_at limit 1;
  select m.user_id into other from public.members m where m.user_status = 'active' and m.user_id <> someone order by m.created_at limit 1;
  select c.id into cand from public.candidates c where c.deleted_at is null order by c.created_at desc limit 1;
  insert into t_results values ('found two members and a candidate', someone is not null and other is not null and cand is not null);

  -- What counts as automatic.
  insert into t_results values ('Accepted: is automatic', public.email_is_automatic('Accepted: Interview with Virgilio', 'x@example.com', '{}'));
  insert into t_results values ('Aceptada: is automatic', public.email_is_automatic('Aceptada: Entrevista', 'x@example.com', '{}'));
  insert into t_results values ('Invitación actualizada: is automatic', public.email_is_automatic('Invitación actualizada: Entrevista', 'x@example.com', '{}'));
  insert into t_results values ('Automatic reply: is automatic', public.email_is_automatic('Automatic reply: Re: Next steps', 'x@example.com', '{}'));
  insert into t_results values ('an Auto-Submitted header is automatic', public.email_is_automatic('Hello', 'x@example.com', '{"auto-submitted":"auto-replied"}'));
  insert into t_results values ('mailer-daemon is automatic', public.email_is_automatic('Hello', 'MAILER-DAEMON@example.com', '{}'));
  insert into t_results values ('Re: is a real message', not public.email_is_automatic('Re: Next steps', 'x@example.com', '{}'));
  insert into t_results values ('Declined: needs you', not public.email_is_automatic('Declined: Interview', 'x@example.com', '{}'));
  insert into t_results values ('Proposed new time: needs you', not public.email_is_automatic('Proposed new time: Interview', 'x@example.com', '{}'));
  insert into t_results values ('a subject that only mentions an invitation is real', not public.email_is_automatic('Thanks for the invitation', 'x@example.com', '{}'));

  -- someone's mailbox.
  perform pg_temp.mail(someone, tenant, cand, 'qt-waiting', 'received', 'Re: Next steps', 2);
  perform pg_temp.mail(someone, tenant, cand, 'qt-answered', 'received', 'Re: Salary', 3);
  perform pg_temp.mail(someone, tenant, cand, 'qt-answered', 'sent', 'Re: Salary', 1);
  perform pg_temp.mail(someone, tenant, cand, 'qt-auto-after', 'received', 'Re: Availability', 5);
  perform pg_temp.mail(someone, tenant, cand, 'qt-auto-after', 'received', 'Accepted: Interview', 1);
  perform pg_temp.mail(someone, tenant, cand, 'qt-only-auto', 'received', 'Aceptada: Entrevista', 1);
  perform pg_temp.mail(someone, tenant, cand, 'qt-old', 'received', 'Re: Last month', 24 * 40);
  -- other's mailbox.
  perform pg_temp.mail(other, tenant, cand, 'qt-theirs', 'received', 'Re: Their thread', 1);

  perform pg_temp.as_user(someone);
  select array_agg(q.thread_id order by q.thread_id) into threads from public.queue_replies() q where q.thread_id like 'qt-%';
  insert into t_results values ('waiting: ' || coalesce(array_to_string(threads, ','), 'none'),
    threads = array['qt-auto-after', 'qt-waiting']);
  select count(*) into n from public.queue_replies() q where q.thread_id = 'qt-auto-after' and q.subject = 'Re: Availability';
  insert into t_results values ('the row points at the real message, not the calendar answer', n = 1);
  select count(*) into n from public.queue_replies(60) q where q.thread_id = 'qt-old';
  insert into t_results values ('a longer window reaches the older one', n = 1);

  -- Done today, then No reply needed and its Undo.
  d0 := public.queue_done_today();
  n := public.queue_reply_mark(array['qt-waiting'], true);
  insert into t_results values ('marking done touches one conversation (' || n || ')', n = 1);
  select count(*) into n from public.queue_replies() q where q.thread_id = 'qt-waiting';
  insert into t_results values ('marked done leaves the queue', n = 0);
  d1 := public.queue_done_today();
  insert into t_results values ('done today goes up (' || d0 || ' to ' || d1 || ')', d1 = d0 + 1);
  n := public.queue_reply_mark(array['qt-waiting'], false);
  select count(*) into n from public.queue_replies() q where q.thread_id = 'qt-waiting';
  insert into t_results values ('Undo brings it back', n = 1);
  n := public.queue_reply_mark(array['qt-theirs'], true);
  insert into t_results values ('someone can''t mark another mailbox''s conversation (' || n || ')', n = 0);

  -- A new message after Done brings it back.
  n := public.queue_reply_mark(array['qt-waiting'], true);
  perform pg_temp.as_admin();
  -- now() stands still inside the test's transaction, so the new message is dated just after the Done mark.
  perform pg_temp.mail(someone, tenant, cand, 'qt-waiting', 'received', 'Re: One more thing', -0.1);
  perform pg_temp.as_user(someone);
  select count(*) into n from public.queue_replies() q where q.thread_id = 'qt-waiting';
  insert into t_results values ('a new message after Done brings it back', n = 1);

  -- other sees only their own.
  perform pg_temp.as_user(other);
  select array_agg(q.thread_id) into threads from public.queue_replies() q where q.thread_id like 'qt-%';
  insert into t_results values ('other sees only their own: ' || coalesce(array_to_string(threads, ','), 'none'),
    threads = array['qt-theirs']);

  -- Snooze is a column on your own hidden rows.
  perform pg_temp.as_user(someone);
  e := pg_temp.err_of(format(
    'insert into public.dashboard_queue_dismissals (user_id, tenant_id, item_key, snoozed_until) values (%L, %L, %L, now() + interval ''1 day'')',
    someone, tenant, 'scorecard:test:snooze'));
  insert into t_results values ('a person snoozes their own row (' || e || ')', e = 'none');
  select count(*) into n from public.dashboard_queue_dismissals where item_key = 'scorecard:test:snooze' and snoozed_until > now();
  insert into t_results values ('and reads it back with its time', n = 1);
  perform pg_temp.as_user(other);
  select count(*) into n from public.dashboard_queue_dismissals where item_key = 'scorecard:test:snooze';
  insert into t_results values ('nobody else sees it (' || n || ')', n = 0);

  -- Signed out and anon.
  perform pg_temp.as_admin();
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'authenticated', true);
  e := pg_temp.err_of('select * from public.queue_replies()');
  insert into t_results values ('signed out is refused (' || e || ')', e = 'GQU01');
  perform pg_temp.as_admin();
  insert into t_results values ('anon can''t read replies', not has_function_privilege('anon', 'public.queue_replies(int)', 'execute'));
  insert into t_results values ('anon can''t mark', not has_function_privilege('anon', 'public.queue_reply_mark(text[], boolean)', 'execute'));
  insert into t_results values ('anon can''t count', not has_function_privilege('anon', 'public.queue_done_today()', 'execute'));
end $$;

select * from t_results;
