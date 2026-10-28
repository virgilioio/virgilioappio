-- Run after 20261028140000_offer_approval_links inside a transaction that is rolled back.
-- Offer approval links: the approver's bell and its reminder open the candidate
-- in the job at the approval (?focus=approval), the "offer approved" bell opens
-- the Offer tab, and no bell or function keeps the old job-page address.
-- A fake offer on a real job and candidate in Virgilio's workspace: Allan asks,
-- the support account then another teammate approve. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
create temp table t_ids (k text primary key, v uuid);
insert into t_ids values
  ('allan', '7acbeead-b1b8-442c-b316-bff9779dc7de'),
  ('support', 'e9bfab1d-5e9a-49d0-af89-5f97ef89b6fe'),
  ('third', 'd294b6a2-3736-43f6-b8c3-d85845fcbe89'),
  ('job', 'cc0428c9-9ac4-433d-96c7-e00dd961cc8a'),
  ('cand', '26226545-59d7-44b6-8de6-cf9a7e4e51d5'),
  ('org', '5ba7b145-f251-4b18-8900-724cb06028ab'),
  ('o1', gen_random_uuid()), ('r1', gen_random_uuid()), ('s1', gen_random_uuid()), ('s2', gen_random_uuid());
create temp view t_i as select jsonb_object_agg(k, v) as i from t_ids;
create temp view t_link as
  select '/jobs/' || (i->>'job') || '/candidates/' || (i->>'cand') as base from t_i;

insert into public.offer_letters (id, candidate_id, job_id, organization_id, title)
select (i->>'o1')::uuid, (i->>'cand')::uuid, (i->>'job')::uuid, (i->>'org')::uuid, 'Fake offer (links test)' from t_i;
insert into public.offer_approval_requests (id, offer_letter_id, job_id, organization_id, candidate_id, requested_by, status, current_step_order)
select (i->>'r1')::uuid, (i->>'o1')::uuid, (i->>'job')::uuid, (i->>'org')::uuid, (i->>'cand')::uuid, (i->>'allan')::uuid, 'pending', 1 from t_i;
insert into public.offer_approval_request_steps (id, request_id, approver_user_id, step_order, status)
select (i->>s)::uuid, (i->>'r1')::uuid, (i->>who)::uuid, n, 'pending'
from t_i, (values ('s1', 'support', 1), ('s2', 'third', 2)) x(s, who, n);

insert into t_results select 'turn: the approver''s bell opens the approval',
  (select count(*) = 1 from public.notifications
   where user_id = (select v from t_ids where k = 'support') and metadata->>'event' = 'approval_requested'
     and metadata->>'request_id' = (select v from t_ids where k = 'r1')::text
     and action_url = (select base from t_link) || '?focus=approval');

-- Allan reminds the approver (as the signed-in person).
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = 'allan'), 'role', 'authenticated')::text, true);
select public.offer_approval_remind((select v from t_ids where k = 'r1'));
insert into t_results select 'reminder: the bell opens the approval',
  (select count(*) = 1 from public.notifications
   where user_id = (select v from t_ids where k = 'support') and metadata->>'event' = 'approval_reminder'
     and metadata->>'request_id' = (select v from t_ids where k = 'r1')::text
     and action_url = (select base from t_link) || '?focus=approval');
select set_config('request.jwt.claims', '', true);

-- The second approver's turn, then every approver approved.
update public.offer_approval_request_steps set status = 'approved', decided_at = now() - interval '1 minute' where id = (select v from t_ids where k = 's1');
update public.offer_approval_requests set current_step_order = 2 where id = (select v from t_ids where k = 'r1');
insert into t_results select 'turn: the next approver''s bell opens the approval',
  (select count(*) = 1 from public.notifications
   where user_id = (select v from t_ids where k = 'third') and metadata->>'event' = 'approval_requested'
     and metadata->>'request_id' = (select v from t_ids where k = 'r1')::text
     and action_url = (select base from t_link) || '?focus=approval');
update public.offer_approval_request_steps set status = 'approved', decided_at = now() where id = (select v from t_ids where k = 's2');
update public.offer_approval_requests set status = 'approved' where id = (select v from t_ids where k = 'r1');
insert into t_results select 'approved: the bell for the person who asked opens the Offer tab',
  (select count(*) = 1 from public.notifications
   where user_id = (select v from t_ids where k = 'allan') and metadata->>'event' = 'approval_complete'
     and metadata->>'request_id' = (select v from t_ids where k = 'r1')::text
     and action_url = (select base from t_link) || '?tab=offer');

insert into t_results select 'no bell keeps the old job-page address',
  not exists (select 1 from public.notifications where action_url like '/jobs/%?candidate=%&tab=offer');
insert into t_results select 'no function writes the old address',
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.prosrc like '%''?candidate=''%');

select * from t_results order by ok, check_name;
