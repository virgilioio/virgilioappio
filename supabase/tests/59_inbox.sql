-- Run after 20261025030939_inbox inside a transaction that is rolled back.
-- The Inbox shows only your own mailbox and only candidate conversations;
-- folders, the job label, search, unread (Gmail or Gio), Done and a reply
-- after Done behave like a mail client; nobody reads another person's
-- mailbox; externals have no Inbox. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  other uuid;
  alex uuid;
  org uuid;
  job uuid;
  c1 uuid;
  c2 uuid;
  n int;
  st text;
  d jsonb;
  ids text[];
begin
  select m.user_id into other from public.members m
  where m.tenant_id = ten and m.user_status = 'active' and m.user_id <> allan
    and m.user_type::text <> 'external' and m.user_id is not null
  limit 1;
  select m.user_id into alex from public.members m join public.profiles p on p.user_id = m.user_id
  where m.tenant_id = ten and p.last_name ilike 'westwood';

  select organization_id into org from public.jobs where tenant_id = ten and organization_id <> ten limit 1;
  insert into public.jobs (title, organization_id, tenant_id, status, created_by)
  values ('TEST Inbox job', org, ten, 'open', allan) returning id into job;
  insert into public.job_assignments (job_id, user_id, organization_id, assigned_by, role)
  values (job, allan, org, allan, 'recruiter');
  insert into public.candidates (candidate_name, email, tenant_id, organization_id)
  values ('TEST Inbox Ana', 'test.inbox.ana@example.com', ten, ten) returning id into c1;
  insert into public.candidates (candidate_name, email, tenant_id, organization_id)
  values ('TEST Inbox Ben', 'test.inbox.ben@example.com', ten, ten) returning id into c2;
  insert into public.job_candidate_associations (job_id, candidate_id, status)
  values (job, c1, 'active');

  -- T1: Ana wrote (unread in Gmail, with an attachment), Allan answered.
  insert into public.email_logs (user_id, tenant_id, organization_id, direction, status, from_address, to_addresses,
                                 subject, body_text, snippet, thread_id, candidate_id, is_read, received_at, attachments)
  values (allan, ten, ten, 'received', 'delivered', 'test.inbox.ana@example.com', array['allan@virgilio.tech'],
          'TEST Inbox interview', 'Here is my portfolio', 'Here is my portfolio', 'test-inbox-t1', c1, false,
          now() - interval '3 hours',
          '[{"filename":"portfolio.pdf","content_type":"application/pdf","content":"QUJD"}]'::jsonb);
  insert into public.email_logs (user_id, tenant_id, organization_id, direction, status, from_address, to_addresses,
                                 subject, body_text, thread_id, candidate_id, sent_at)
  values (allan, ten, ten, 'sent', 'sent', 'allan@virgilio.tech', array['test.inbox.ana@example.com'],
          'Re: TEST Inbox interview', 'Thanks, see you Tuesday', 'test-inbox-t1', c1, now() - interval '2 hours');
  -- T2: Ben wrote (read in Gmail); Ben is on no job.
  insert into public.email_logs (user_id, tenant_id, organization_id, direction, status, from_address, to_addresses,
                                 subject, body_text, thread_id, candidate_id, is_read, received_at)
  values (allan, ten, ten, 'received', 'delivered', 'test.inbox.ben@example.com', array['allan@virgilio.tech'],
          'TEST Inbox question', 'Is the role remote? zebracrossing', 'test-inbox-t2', c2, true, now() - interval '1 hour');
  -- T3: no candidate.
  insert into public.email_logs (user_id, tenant_id, organization_id, direction, status, from_address, to_addresses,
                                 subject, thread_id, is_read, received_at)
  values (allan, ten, ten, 'received', 'delivered', 'someone@example.com', array['allan@virgilio.tech'],
          'TEST Inbox newsletter', 'test-inbox-t3', false, now() - interval '30 minutes');
  -- T4: Ana in someone else's mailbox.
  insert into public.email_logs (user_id, tenant_id, organization_id, direction, status, from_address, to_addresses,
                                 subject, thread_id, candidate_id, is_read, received_at)
  values (other, ten, ten, 'received', 'delivered', 'test.inbox.ana@example.com', array['someone.else@virgilio.tech'],
          'TEST Inbox other mailbox', 'test-inbox-t4', c1, false, now() - interval '20 minutes');
  -- T5: Allan wrote to Ana, no answer yet.
  insert into public.email_logs (user_id, tenant_id, organization_id, direction, status, from_address, to_addresses,
                                 subject, thread_id, candidate_id, sent_at)
  values (allan, ten, ten, 'sent', 'sent', 'allan@virgilio.tech', array['test.inbox.ana@example.com'],
          'TEST Inbox offer', 'test-inbox-t5', c1, now() - interval '10 minutes');

  -- As Allan.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  insert into t_results values ('an admin with a Recruiter seat has the Inbox', public.inbox_access());

  select array_agg(thread_id order by last_at desc) into ids
  from public.inbox_threads('inbox', null, null, null, null, 200) where thread_id like 'test-inbox-%';
  insert into t_results values ('Inbox: conversations with candidates that wrote, newest first',
    ids = array['test-inbox-t2', 'test-inbox-t1']);
  select count(*) into n from public.inbox_threads('all', null, null, null, null, 200) where thread_id = 'test-inbox-t3';
  insert into t_results values ('mail with no candidate never shows', n = 0);
  select count(*) into n from public.inbox_threads('all', null, null, null, null, 200) where thread_id = 'test-inbox-t4';
  insert into t_results values ('someone else''s mailbox never shows', n = 0);
  insert into t_results values ('someone else''s conversation can''t be opened', public.inbox_thread('test-inbox-t4') is null);
  insert into t_results values ('mail with no candidate can''t be opened', public.inbox_thread('test-inbox-t3') is null);

  insert into t_results values ('unread in Gmail is unread',
    (select unread from public.inbox_threads('inbox', null, null, null, null, 200) where thread_id = 'test-inbox-t1'));
  insert into t_results values ('read in Gmail is read',
    not (select unread from public.inbox_threads('inbox', null, null, null, null, 200) where thread_id = 'test-inbox-t2'));
  insert into t_results values ('the conversation carries the candidate''s job',
    (select job_id = job and job_title = 'TEST Inbox job' and candidate_name = 'TEST Inbox Ana'
       and subject = 'TEST Inbox interview' and message_count = 2 and has_attachments
     from public.inbox_threads('inbox', null, null, null, null, 200) where thread_id = 'test-inbox-t1'));
  insert into t_results values ('a candidate on no job has no job',
    (select job_id is null from public.inbox_threads('inbox', null, null, null, null, 200) where thread_id = 'test-inbox-t2'));

  select array_agg(thread_id order by thread_id) into ids
  from public.inbox_threads('needs_reply', null, null, null, null, 200) where thread_id like 'test-inbox-%';
  insert into t_results values ('Needs reply: the candidate wrote last', ids = array['test-inbox-t2']);
  select array_agg(thread_id order by thread_id) into ids
  from public.inbox_threads('sent', null, null, null, null, 200) where thread_id like 'test-inbox-%';
  insert into t_results values ('Sent: conversations you wrote in', ids = array['test-inbox-t1', 'test-inbox-t5']);
  select array_agg(thread_id order by thread_id) into ids
  from public.inbox_threads('all', job, null, null, null, 200) where thread_id like 'test-inbox-%';
  insert into t_results values ('the job label shows that job''s candidates', ids = array['test-inbox-t1', 'test-inbox-t5']);
  select array_agg(thread_id) into ids from public.inbox_threads('all', null, 'inbox ben', null, null, 200);
  insert into t_results values ('search finds the candidate', ids = array['test-inbox-t2']);
  select array_agg(thread_id) into ids from public.inbox_threads('all', null, 'ZEBRACROSSING', null, null, 200);
  insert into t_results values ('search finds words in a message', ids = array['test-inbox-t2']);
  select array_agg(thread_id) into ids from public.inbox_threads('all', null, '100%_', null, null, 200);
  insert into t_results values ('% and _ in a search are plain characters', ids is null);

  select array_agg(thread_id order by last_at desc) into ids
  from public.inbox_threads('all', null, null, null, null, 200) where thread_id like 'test-inbox-%';
  select array_agg(thread_id) into ids from public.inbox_threads('all', job, null,
    (select last_at from public.inbox_threads('all', job, null, null, null, 200) where thread_id = 'test-inbox-t5'),
    'test-inbox-t5', 200) where thread_id like 'test-inbox-%';
  insert into t_results values ('the next page starts after the last row', ids = array['test-inbox-t1']);

  d := public.inbox_thread('test-inbox-t1');
  insert into t_results values ('a conversation opens oldest first',
    jsonb_array_length(d->'messages') = 2
    and d->'messages'->0->>'direction' = 'received' and d->'messages'->1->>'direction' = 'sent'
    and d->'thread'->>'candidate_name' = 'TEST Inbox Ana');
  insert into t_results values ('attachments come without their content',
    d->'messages'->0->'attachments'->0->>'filename' = 'portfolio.pdf'
    and not (d->'messages'->0->'attachments'->0 ? 'content'));

  -- Read and unread.
  n := public.inbox_mark(array['test-inbox-t1'], 'read');
  insert into t_results values ('reading a conversation marks it read',
    n = 1 and not (select unread from public.inbox_threads('inbox', null, null, null, null, 200) where thread_id = 'test-inbox-t1'));
  insert into t_results values ('Gio leaves Gmail''s own flag alone',
    (select is_read from public.email_logs where thread_id = 'test-inbox-t1' and direction = 'received') = false);
  insert into public.email_logs (user_id, tenant_id, organization_id, direction, status, from_address, to_addresses,
                                 subject, thread_id, candidate_id, is_read, received_at)
  values (allan, ten, ten, 'received', 'delivered', 'test.inbox.ana@example.com', array['allan@virgilio.tech'],
          'Re: TEST Inbox interview', 'test-inbox-t1', c1, false, now() + interval '1 minute');
  insert into t_results values ('a new message makes it unread again',
    (select unread and last_direction = 'received' from public.inbox_threads('inbox', null, null, null, null, 200) where thread_id = 'test-inbox-t1'));
  perform public.inbox_mark(array['test-inbox-t2'], 'unread');
  insert into t_results values ('Mark unread',
    (select unread from public.inbox_threads('inbox', null, null, null, null, 200) where thread_id = 'test-inbox-t2'));
  perform public.inbox_mark(array['test-inbox-t2'], 'read');
  insert into t_results values ('then read again',
    not (select unread from public.inbox_threads('inbox', null, null, null, null, 200) where thread_id = 'test-inbox-t2'));

  -- Done.
  perform public.inbox_mark(array['test-inbox-t2'], 'done');
  select count(*) into n from public.inbox_threads('inbox', null, null, null, null, 200) where thread_id = 'test-inbox-t2';
  insert into t_results values ('Done takes it out of the Inbox', n = 0);
  select count(*) into n from public.inbox_threads('done', null, null, null, null, 200) where thread_id = 'test-inbox-t2';
  insert into t_results values ('and into Done', n = 1);
  select count(*) into n from public.inbox_threads('needs_reply', null, null, null, null, 200) where thread_id = 'test-inbox-t2';
  insert into t_results values ('and out of Needs reply', n = 0);
  perform public.inbox_mark(array['test-inbox-t2'], 'inbox');
  select count(*) into n from public.inbox_threads('inbox', null, null, null, null, 200) where thread_id = 'test-inbox-t2';
  insert into t_results values ('Move to Inbox brings it back', n = 1);
  perform public.inbox_mark(array['test-inbox-t2'], 'done');
  insert into public.email_logs (user_id, tenant_id, organization_id, direction, status, from_address, to_addresses,
                                 subject, thread_id, candidate_id, is_read, received_at)
  values (allan, ten, ten, 'received', 'delivered', 'test.inbox.ben@example.com', array['allan@virgilio.tech'],
          'Re: TEST Inbox question', 'test-inbox-t2', c2, false, now() + interval '2 minutes');
  select count(*) into n from public.inbox_threads('inbox', null, null, null, null, 200) where thread_id = 'test-inbox-t2';
  insert into t_results values ('a new message after Done brings it back', n = 1);

  n := public.inbox_mark(array['test-inbox-t3', 'test-inbox-t4'], 'done');
  insert into t_results values ('marking only touches your own candidate conversations', n = 0);
  select count(*) into n from public.inbox_thread_state;
  insert into t_results values ('you read only your own thread state',
    n = (select count(*) from public.inbox_thread_state where user_id = allan));
  begin
    insert into public.inbox_thread_state (user_id, thread_id, done_at) values (other, 'test-inbox-t4', now());
    insert into t_results values ('thread state is written only through inbox_mark', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('thread state is written only through inbox_mark', st = '42501');
  end;

  d := public.inbox_counts();
  insert into t_results values ('counts list your open jobs with their unread',
    exists (select 1 from jsonb_array_elements(d->'jobs') j
            where (j->>'job_id')::uuid = job and (j->>'unread')::int = 1));
  insert into t_results values ('counts carry the Inbox unread and Needs reply',
    (d->>'inbox_unread')::int >= 2 and (d->>'needs_reply')::int >= 2);

  begin
    perform public.inbox_threads('spam', null, null, null, null, 50);
    insert into t_results values ('an unknown folder is refused', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('an unknown folder is refused', st = 'GIB02');
  end;

  -- As Alex (external).
  perform set_config('request.jwt.claims', json_build_object('sub', alex, 'role', 'authenticated')::text, true);
  insert into t_results values ('an external has no Inbox', not public.inbox_access());
  begin
    perform public.inbox_threads('inbox', null, null, null, null, 50);
    insert into t_results values ('an external can''t list an Inbox', false);
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    insert into t_results values ('an external can''t list an Inbox', st = 'GIB01');
  end;

end $$;

do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n') into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
