-- Inbox (Allan, 2026-10-25): your own Gmail, candidate mail only, laid out
-- like a mail client. Admins and anyone holding a Recruiter or Sourcer seat on
-- an open job use it; nobody ever reads another person's mailbox here, admins
-- included. The mail itself is what the Gmail sync already keeps (candidate
-- mail only since 2026-10-12); this adds per-person read and Done state, the
-- folder lists and counts, one conversation, and marking.
--
-- Read status: a message counts as read when Gmail says so (email_logs.is_read,
-- refreshed by the sync) or when you read the thread in Gio after it arrived
-- (inbox_thread_state.read_at). Gio never writes email_logs, so the next sync
-- can't flip a thread back to unread. Done is Gio's own archive: your Gmail is
-- not touched, and a new message from the candidate brings the thread back.

-- 1. Per-person state of a thread ------------------------------------------
create table if not exists public.inbox_thread_state (
  user_id uuid not null,
  thread_id text not null,
  read_at timestamptz,
  marked_unread boolean not null default false,
  done_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

alter table public.inbox_thread_state enable row level security;

-- Read your own; every write goes through inbox_mark.
create policy inbox_thread_state_read_own on public.inbox_thread_state
  for select to authenticated using (user_id = auth.uid());

revoke all on public.inbox_thread_state from anon;
grant select on public.inbox_thread_state to authenticated;

create index if not exists email_logs_user_thread
  on public.email_logs (user_id, thread_id) where thread_id is not null;

-- 2. Who uses the Inbox -----------------------------------------------------
create or replace function public.inbox_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(public.get_user_type_secure() = 'platform_admin', false)
    or exists (
      select 1 from public.members m
      where m.user_id = auth.uid()
        and m.user_status = 'active'
        and m.system_role = 'admin'
        and m.user_type::text <> 'external'
    )
    or exists (
      select 1
      from public.job_assignments s
      join public.jobs j on j.id = s.job_id
      join public.members m on m.user_id = s.user_id and m.tenant_id = j.tenant_id
      where s.user_id = auth.uid()
        and s.deleted_at is null
        and s.role::text in ('recruiter', 'sourcer')
        and j.status::text = 'open'
        and j.deleted_at is null
        and m.user_status = 'active'
    )
$function$;

revoke execute on function public.inbox_access() from public, anon;
grant execute on function public.inbox_access() to authenticated, service_role;

-- 3. One row per candidate conversation in a person's mailbox ---------------
-- Internal: called by the functions below with the caller's id.
create or replace function public.inbox_base(_uid uuid)
returns table (
  thread_id text,
  candidate_id uuid,
  candidate_name text,
  candidate_email text,
  job_id uuid,
  job_title text,
  subject text,
  snippet text,
  last_at timestamptz,
  last_direction text,
  last_received_at timestamptz,
  message_count int,
  unread boolean,
  has_attachments boolean,
  has_received boolean,
  has_sent boolean,
  done_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $function$
  with mine as (
    select e.thread_id, e.candidate_id, e.job_id, e.direction, e.subject,
           coalesce(nullif(btrim(e.snippet), ''), left(btrim(e.body_text), 200)) as snippet,
           e.is_read, e.received_at,
           coalesce(e.received_at, e.sent_at, e.created_at) as at,
           (jsonb_typeof(e.attachments) = 'array' and jsonb_array_length(e.attachments) > 0) as has_att
    from public.email_logs e
    where e.user_id = _uid
      and e.thread_id is not null
      and coalesce(e.status, '') <> 'failed'
  ),
  threads as (
    select m.thread_id,
           (array_agg(m.candidate_id order by m.at desc) filter (where m.candidate_id is not null))[1] as candidate_id,
           (array_agg(m.job_id order by m.at desc) filter (where m.job_id is not null))[1] as mail_job_id,
           (array_agg(m.subject order by m.at) filter (where nullif(btrim(m.subject), '') is not null))[1] as subject,
           (array_agg(m.snippet order by m.at desc))[1] as snippet,
           (array_agg(m.direction order by m.at desc))[1] as last_direction,
           max(m.at) as last_at,
           max(m.received_at) filter (where m.direction = 'received') as last_received_at,
           max(m.received_at) filter (where m.direction = 'received' and m.is_read is false) as last_unread_at,
           count(*)::int as message_count,
           coalesce(bool_or(m.has_att), false) as has_attachments,
           bool_or(m.direction = 'received') as has_received,
           bool_or(m.direction = 'sent') as has_sent
    from mine m
    group by m.thread_id
  )
  select t.thread_id, t.candidate_id, c.candidate_name,
         coalesce(c.email, c.contact_email) as candidate_email,
         coalesce(aj.job_id, t.mail_job_id) as job_id,
         jt.title as job_title,
         t.subject, t.snippet, t.last_at, t.last_direction, t.last_received_at,
         t.message_count,
         coalesce(s.marked_unread, false)
           or coalesce(t.last_unread_at > coalesce(s.read_at, '-infinity'::timestamptz), false) as unread,
         t.has_attachments, t.has_received, t.has_sent, s.done_at
  from threads t
  join public.candidates c on c.id = t.candidate_id and c.deleted_at is null
  left join public.inbox_thread_state s on s.user_id = _uid and s.thread_id = t.thread_id
  left join lateral (
    select a.job_id
    from public.job_candidate_associations a
    join public.jobs j on j.id = a.job_id and j.deleted_at is null
    where a.candidate_id = t.candidate_id
    order by (a.job_id is not distinct from t.mail_job_id) desc,
             (j.status::text = 'open' and exists (
                select 1 from public.job_assignments sa
                where sa.job_id = a.job_id and sa.user_id = _uid and sa.deleted_at is null
                  and sa.role::text in ('recruiter', 'sourcer'))) desc,
             (j.status::text = 'open') desc,
             a.created_at desc
    limit 1
  ) aj on true
  left join public.jobs jt on jt.id = coalesce(aj.job_id, t.mail_job_id) and jt.deleted_at is null
$function$;

revoke execute on function public.inbox_base(uuid) from public, anon, authenticated;

-- 4. A folder ----------------------------------------------------------------
-- _folder: inbox · needs_reply · sent · done · all. _job_id narrows to one job
-- (the candidate is on it). _search matches the candidate, subject and the
-- text of any message. Newest first; pass the last row's last_at and
-- thread_id to get the next page.
create or replace function public.inbox_threads(
  _folder text default 'inbox',
  _job_id uuid default null,
  _search text default null,
  _before_at timestamptz default null,
  _before_thread text default null,
  _limit int default 50
)
returns table (
  thread_id text,
  candidate_id uuid,
  candidate_name text,
  candidate_email text,
  job_id uuid,
  job_title text,
  subject text,
  snippet text,
  last_at timestamptz,
  last_direction text,
  message_count int,
  unread boolean,
  has_attachments boolean,
  done boolean
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  uid uuid := auth.uid();
  q text := nullif(btrim(coalesce(_search, '')), '');
  pat text;
begin
  if uid is null or not public.inbox_access() then
    raise exception 'The Inbox is for admins, Recruiters and Sourcers' using errcode = 'GIB01';
  end if;
  if _folder not in ('inbox', 'needs_reply', 'sent', 'done', 'all') then
    raise exception 'Unknown folder %', _folder using errcode = 'GIB02';
  end if;
  if q is not null then
    pat := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select b.thread_id, b.candidate_id, b.candidate_name, b.candidate_email, b.job_id, b.job_title,
         b.subject, b.snippet, b.last_at, b.last_direction, b.message_count, b.unread,
         b.has_attachments,
         (b.done_at is not null and (b.last_received_at is null or b.last_received_at <= b.done_at)) as done
  from public.inbox_base(uid) b
  where case _folder
          when 'inbox' then b.has_received
            and (b.done_at is null or b.last_received_at > b.done_at)
          when 'needs_reply' then b.last_direction = 'received'
            and (b.done_at is null or b.last_received_at > b.done_at)
          when 'sent' then b.has_sent
          when 'done' then b.done_at is not null
            and (b.last_received_at is null or b.last_received_at <= b.done_at)
          else true
        end
    and (_job_id is null or b.job_id = _job_id or exists (
          select 1 from public.job_candidate_associations a
          where a.candidate_id = b.candidate_id and a.job_id = _job_id))
    and (pat is null
         or b.candidate_name ilike pat
         or b.candidate_email ilike pat
         or exists (
           select 1 from public.email_logs e
           where e.user_id = uid and e.thread_id = b.thread_id
             and (e.subject ilike pat or e.snippet ilike pat or e.body_text ilike pat
                  or e.from_address ilike pat or array_to_string(e.to_addresses, ' ') ilike pat)))
    and (_before_at is null
         or b.last_at < _before_at
         or (b.last_at = _before_at and b.thread_id < coalesce(_before_thread, '')))
  order by b.last_at desc, b.thread_id desc
  limit greatest(1, least(coalesce(_limit, 50), 200));
end
$function$;

revoke execute on function public.inbox_threads(text, uuid, text, timestamptz, text, int) from public, anon;
grant execute on function public.inbox_threads(text, uuid, text, timestamptz, text, int) to authenticated;

-- 5. Counts for the folder column and the rail tile ------------------------
-- { inbox_unread, needs_reply, jobs: [{ job_id, title, unread }] }; jobs are
-- the open jobs where you hold a Recruiter or Sourcer seat.
create or replace function public.inbox_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  uid uuid := auth.uid();
  res jsonb;
begin
  if uid is null or not public.inbox_access() then
    raise exception 'The Inbox is for admins, Recruiters and Sourcers' using errcode = 'GIB01';
  end if;

  with b as (
    select x.*, (x.has_received and (x.done_at is null or x.last_received_at > x.done_at)) as in_inbox
    from public.inbox_base(uid) x
  ),
  my_jobs as (
    select distinct j.id, j.title
    from public.job_assignments s
    join public.jobs j on j.id = s.job_id and j.deleted_at is null
    where s.user_id = uid and s.deleted_at is null
      and s.role::text in ('recruiter', 'sourcer')
      and j.status::text = 'open'
  )
  select jsonb_build_object(
    'inbox_unread', (select count(*) from b where b.in_inbox and b.unread),
    'needs_reply', (select count(*) from b where b.in_inbox and b.last_direction = 'received'),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object('job_id', mj.id, 'title', mj.title, 'unread', (
        select count(*) from b
        where b.in_inbox and b.unread
          and (b.job_id = mj.id or exists (
                select 1 from public.job_candidate_associations a
                where a.candidate_id = b.candidate_id and a.job_id = mj.id))
      )) order by mj.title)
      from my_jobs mj
    ), '[]'::jsonb)
  ) into res;
  return res;
end
$function$;

revoke execute on function public.inbox_counts() from public, anon;
grant execute on function public.inbox_counts() to authenticated;

-- 6. One conversation --------------------------------------------------------
-- { thread: {…the folder row…}, messages: [...] } oldest first, or null when
-- the thread isn't a candidate conversation in your own mailbox. Attachments
-- come without their content.
create or replace function public.inbox_thread(_thread_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  uid uuid := auth.uid();
  head jsonb;
begin
  if uid is null or not public.inbox_access() then
    raise exception 'The Inbox is for admins, Recruiters and Sourcers' using errcode = 'GIB01';
  end if;

  select jsonb_build_object(
           'thread_id', b.thread_id, 'candidate_id', b.candidate_id,
           'candidate_name', b.candidate_name, 'candidate_email', b.candidate_email,
           'job_id', b.job_id, 'job_title', b.job_title, 'subject', b.subject,
           'last_at', b.last_at, 'last_direction', b.last_direction,
           'message_count', b.message_count, 'unread', b.unread,
           'done', b.done_at is not null and (b.last_received_at is null or b.last_received_at <= b.done_at))
    into head
  from public.inbox_base(uid) b
  where b.thread_id = _thread_id;

  if head is null then
    return null;
  end if;

  return jsonb_build_object('thread', head, 'messages', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', e.id, 'direction', e.direction, 'status', e.status,
             'from_address', e.from_address, 'to_addresses', e.to_addresses,
             'cc_addresses', e.cc_addresses, 'subject', e.subject,
             'body_html', e.body_html, 'body_text', e.body_text, 'snippet', e.snippet,
             'at', coalesce(e.received_at, e.sent_at, e.created_at),
             'attachments', case when jsonb_typeof(e.attachments) = 'array' then
               (select coalesce(jsonb_agg(a - 'content'), '[]'::jsonb) from jsonb_array_elements(e.attachments) a)
               else '[]'::jsonb end,
             'rfc822_message_id', e.rfc822_message_id, 'in_reply_to', e.in_reply_to,
             'references_header', e.references_header,
             'candidate_id', e.candidate_id, 'job_id', e.job_id)
           order by coalesce(e.received_at, e.sent_at, e.created_at), e.id)
    from public.email_logs e
    where e.user_id = uid and e.thread_id = _thread_id
      and coalesce(e.status, '') <> 'failed'
  ), '[]'::jsonb));
end
$function$;

revoke execute on function public.inbox_thread(text) from public, anon;
grant execute on function public.inbox_thread(text) to authenticated;

-- 7. Marking -----------------------------------------------------------------
-- _action: read · unread · done · inbox (back from Done). Only threads that
-- are candidate conversations in your own mailbox change; returns how many.
create or replace function public.inbox_mark(_thread_ids text[], _action text)
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
  if uid is null or not public.inbox_access() then
    raise exception 'The Inbox is for admins, Recruiters and Sourcers' using errcode = 'GIB01';
  end if;
  if _action not in ('read', 'unread', 'done', 'inbox') then
    raise exception 'Unknown action %', _action using errcode = 'GIB02';
  end if;

  insert into public.inbox_thread_state as st (user_id, thread_id, read_at, marked_unread, done_at, updated_at)
  select uid, b.thread_id,
         case when _action = 'read' then now() end,
         _action = 'unread',
         case when _action = 'done' then now() end,
         now()
  from public.inbox_base(uid) b
  where b.thread_id = any (coalesce(_thread_ids, '{}'))
  on conflict (user_id, thread_id) do update set
    read_at = case when _action = 'read' then now() else st.read_at end,
    marked_unread = case when _action = 'read' then false
                         when _action = 'unread' then true
                         else st.marked_unread end,
    done_at = case when _action = 'done' then now()
                   when _action = 'inbox' then null
                   else st.done_at end,
    updated_at = now();
  get diagnostics n = row_count;
  return n;
end
$function$;

revoke execute on function public.inbox_mark(text[], text) from public, anon;
grant execute on function public.inbox_mark(text[], text) to authenticated;
