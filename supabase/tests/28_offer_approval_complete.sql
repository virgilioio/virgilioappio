-- Run after 20261019011108_offer_approval_complete (link as of 20261028140000_offer_approval_links) inside a transaction that is rolled back.
-- Fake offers and approval requests on a real job and candidate in Virgilio's workspace:
-- Allan asks, the support account and another teammate approve. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
create temp table t_ids (k text primary key, v uuid);
insert into t_ids values
  ('allan', '7acbeead-b1b8-442c-b316-bff9779dc7de'),
  ('support', 'e9bfab1d-5e9a-49d0-af89-5f97ef89b6fe'),
  ('third', 'd294b6a2-3736-43f6-b8c3-d85845fcbe89'),
  ('job', 'cc0428c9-9ac4-433d-96c7-e00dd961cc8a'),
  ('cand', '26226545-59d7-44b6-8de6-cf9a7e4e51d5'),
  ('org', '5ba7b145-f251-4b18-8900-724cb06028ab'),
  ('r1', gen_random_uuid()), ('r2', gen_random_uuid()), ('r3', gen_random_uuid()), ('r4', gen_random_uuid()), ('r5', gen_random_uuid()),
  ('r1s1', gen_random_uuid()), ('r1s2', gen_random_uuid()), ('r2s1', gen_random_uuid()), ('r3s1', gen_random_uuid()),
  ('r4s1', gen_random_uuid()), ('r5s1', gen_random_uuid()), ('r5s2', gen_random_uuid()),
  ('o1', gen_random_uuid()), ('o2', gen_random_uuid()), ('o3', gen_random_uuid()), ('o4', gen_random_uuid()), ('o5', gen_random_uuid());

create temp view t_i as select jsonb_object_agg(k, v) as i from t_ids;

-- One fake offer per request (an offer holds one active request at a time).
insert into public.offer_letters (id, candidate_id, job_id, organization_id, title)
select (i->>('o' || n))::uuid, (i->>'cand')::uuid, (i->>'job')::uuid, (i->>'org')::uuid, 'Fake offer ' || n
from t_i, generate_series(1, 5) n;
-- Requests, written the way the browser writes them.
insert into public.offer_approval_requests (id, offer_letter_id, job_id, organization_id, candidate_id, requested_by, status, current_step_order)
select (i->>r)::uuid, (i->>('o' || substr(r, 2)))::uuid, (i->>'job')::uuid, (i->>'org')::uuid, (i->>'cand')::uuid,
       (case when r = 'r4' then i->>'third' else i->>'allan' end)::uuid, 'pending', 1
from t_i, unnest(array['r1', 'r2', 'r3', 'r4', 'r5']) r;
insert into public.offer_approval_request_steps (id, request_id, approver_user_id, step_order, status)
select (i->>s)::uuid, (i->>r)::uuid, (i->>who)::uuid, n, st
from t_i, (values
  ('r1s1', 'r1', 'support', 1, 'pending'), ('r1s2', 'r1', 'third', 2, 'pending'),
  ('r2s1', 'r2', 'support', 1, 'pending'),
  ('r3s1', 'r3', 'support', 1, 'pending'),
  ('r4s1', 'r4', 'third', 1, 'pending'),
  ('r5s1', 'r5', 'support', 1, 'pending'), ('r5s2', 'r5', 'third', 2, 'pending')) x(s, r, who, n, st);

-- r1: two approvers in turn. After the first, nothing; after the second, the news.
update public.offer_approval_request_steps set status = 'approved', decided_at = now() - interval '1 minute' where id = (select v from t_ids where k = 'r1s1');
update public.offer_approval_requests set current_step_order = 2 where id = (select v from t_ids where k = 'r1');
insert into t_results select 'chain: nothing after the first of two approvals',
  not exists (select 1 from public.offer_approval_outcomes where request_id = (select v from t_ids where k = 'r1'))
  and not exists (select 1 from public.notifications where metadata->>'request_id' = (select v from t_ids where k = 'r1')::text and metadata->>'event' = 'approval_complete');
update public.offer_approval_request_steps set status = 'approved', decided_at = now() where id = (select v from t_ids where k = 'r1s2');
update public.offer_approval_requests set status = 'approved' where id = (select v from t_ids where k = 'r1');
-- Written again afterwards: still once.
update public.offer_approval_requests set status = 'pending' where id = (select v from t_ids where k = 'r1');
update public.offer_approval_requests set status = 'approved' where id = (select v from t_ids where k = 'r1');
insert into t_results select 'chain complete: one email queued for the person who asked',
  (select count(*) = 1 from public.offer_approval_outcomes
   where request_id = (select v from t_ids where k = 'r1') and requester_user_id = (select v from t_ids where k = 'allan')
     and last_approver_user_id = (select v from t_ids where k = 'third'));
insert into t_results select 'chain complete: one bell for the person who asked, from the last approver, with the offer link',
  (select count(*) = 1 from public.notifications
   where user_id = (select v from t_ids where k = 'allan') and metadata->>'event' = 'approval_complete'
     and metadata->>'request_id' = (select v from t_ids where k = 'r1')::text
     and actor_user_id = (select v from t_ids where k = 'third')
     and category = 'offer_event' and title like 'Offer approved for %'
     and preview = 'Both approvers approved it. You can send it for signature.'
     and action_url = '/jobs/' || (select v from t_ids where k = 'job') || '/candidates/' || (select v from t_ids where k = 'cand') || '?tab=offer');

-- r2: the request marked approved first, the step after (the other order): still announced.
update public.offer_approval_requests set status = 'approved' where id = (select v from t_ids where k = 'r2');
insert into t_results select 'order: not while a step is still pending',
  not exists (select 1 from public.offer_approval_outcomes where request_id = (select v from t_ids where k = 'r2'));
update public.offer_approval_request_steps set status = 'approved', decided_at = now() where id = (select v from t_ids where k = 'r2s1');
insert into t_results select 'order: announced once the last step is approved',
  exists (select 1 from public.offer_approval_outcomes where request_id = (select v from t_ids where k = 'r2'))
  and exists (select 1 from public.notifications where metadata->>'request_id' = (select v from t_ids where k = 'r2')::text
              and metadata->>'event' = 'approval_complete' and preview = 'It''s approved. You can send it for signature.');

-- r3: declined. Nothing.
update public.offer_approval_request_steps set status = 'declined', decided_at = now() where id = (select v from t_ids where k = 'r3s1');
update public.offer_approval_requests set status = 'declined' where id = (select v from t_ids where k = 'r3');
insert into t_results select 'declined: nothing is sent',
  not exists (select 1 from public.offer_approval_outcomes where request_id = (select v from t_ids where k = 'r3'))
  and not exists (select 1 from public.notifications where metadata->>'request_id' = (select v from t_ids where k = 'r3')::text and metadata->>'event' = 'approval_complete');

-- r4: the person who asked made the last approval. Nothing.
update public.offer_approval_request_steps set status = 'approved', decided_at = now() where id = (select v from t_ids where k = 'r4s1');
update public.offer_approval_requests set status = 'approved' where id = (select v from t_ids where k = 'r4');
insert into t_results select 'own approval: no news of your own decision',
  not exists (select 1 from public.offer_approval_outcomes where request_id = (select v from t_ids where k = 'r4'));

-- r5: the second step was skipped by its condition; the first approval completes the chain.
update public.offer_approval_request_steps set status = 'skipped' where id = (select v from t_ids where k = 'r5s2');
update public.offer_approval_request_steps set status = 'approved', decided_at = now() where id = (select v from t_ids where k = 'r5s1');
update public.offer_approval_requests set status = 'approved' where id = (select v from t_ids where k = 'r5');
insert into t_results select 'skipped steps count as done',
  (select count(*) = 1 from public.offer_approval_outcomes where request_id = (select v from t_ids where k = 'r5'));

-- The minute job's side.
create temp table t_claim as select * from public.offer_approval_claim_outcomes(200)
  where outcome_id in (select id from public.offer_approval_outcomes where request_id = (select v from t_ids where k = 'r1'));
insert into t_results select 'claim: the email has everything it needs',
  (select count(*) = 1 from t_claim where requester_email = 'allan@virgilio.tech' and candidate_name <> '' and job_title is not null
     and array_length(approver_names, 1) = 2 and last_approver_name <> '' and wants_email is not null);
select public.offer_approval_finish_outcome((select outcome_id from t_claim), true);
insert into t_results select 'finish: sent, and never claimed again',
  (select sent_at is not null from public.offer_approval_outcomes where id = (select outcome_id from t_claim))
  and not exists (select 1 from public.offer_approval_claim_outcomes(200) x where x.outcome_id = (select outcome_id from t_claim));
insert into t_results select 'grants: the outbox and its functions are internal',
  not has_table_privilege('authenticated', 'public.offer_approval_outcomes', 'select')
  and not has_function_privilege('authenticated', 'public.offer_approval_claim_outcomes(int)', 'execute')
  and not has_function_privilege('authenticated', 'public.offer_approval_finish_outcome(uuid,boolean,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.offer_approval_announce(uuid)', 'execute');
insert into t_results select 'minute job: wakes the sender for this outbox too',
  (select command like '%offer_approval_outcomes%' and command like '%offer_approval_notices%' from cron.job where jobname = 'offer-approval-notify');

select check_name as check, ok from t_results;
