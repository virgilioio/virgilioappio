-- Run after 20261019023525_activity_offer_types and 20261019_activity_offer_trail inside a transaction that is rolled back.
-- Fake offers, approvals and a fake agreement on a real job and candidate in Virgilio's
-- workspace: Allan writes the offer and asks, the support account and another teammate
-- approve, the candidate signs. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
create temp table t_ids (k text primary key, v uuid);
insert into t_ids values
  ('allan', '7acbeead-b1b8-442c-b316-bff9779dc7de'),
  ('support', 'e9bfab1d-5e9a-49d0-af89-5f97ef89b6fe'),
  ('third', 'd294b6a2-3736-43f6-b8c3-d85845fcbe89'),
  ('job', 'cc0428c9-9ac4-433d-96c7-e00dd961cc8a'),
  ('cand', '26226545-59d7-44b6-8de6-cf9a7e4e51d5'),
  ('org', '5ba7b145-f251-4b18-8900-724cb06028ab'),
  ('tpl', '24639e0f-36de-4e41-9441-1d01d6ab8e8d'),
  ('o1', gen_random_uuid()), ('o2', gen_random_uuid()), ('o3', gen_random_uuid()),
  ('r1', gen_random_uuid()), ('r2', gen_random_uuid()), ('r3', gen_random_uuid()),
  ('s1', gen_random_uuid()), ('s2', gen_random_uuid()), ('s3', gen_random_uuid()), ('s4', gen_random_uuid()), ('s5', gen_random_uuid()),
  ('env', gen_random_uuid()), ('rc1', gen_random_uuid()), ('rc2', gen_random_uuid());
create temp view t_i as select jsonb_object_agg(k, v) as i from t_ids;
create temp view t_feed as
  select a.* from public.activities a
  where a.entity_id = (select v from t_ids where k = 'cand') and a.created_at >= now() - interval '1 second'
    and a.metadata->>'source' = 'offer_trail';

-- ---- Offers: Allan creates, edits, then the support account edits ----------------------
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated"}', true);
insert into public.offer_letters (id, candidate_id, job_id, organization_id, title, field_values)
select (i->>('o' || n))::uuid, (i->>'cand')::uuid, (i->>'job')::uuid, (i->>'org')::uuid, 'Fake offer ' || n, '{"base":1}'::jsonb
from t_i, generate_series(1, 3) n;
update public.offer_letters set field_values = '{"base":2}' where id = (select v from t_ids where k = 'o1');
update public.offer_letters set field_values = '{"base":3}' where id = (select v from t_ids where k = 'o1');
insert into t_results select 'offer: created, in the in-job feed (job_id)',
  (select count(*) = 3 from t_feed where activity_type = 'offer_created' and metadata->>'job_id' = (select v from t_ids where k = 'job')::text
     and user_id = (select v from t_ids where k = 'allan'));
insert into t_results select 'offer: edits right after creating it are part of creating it',
  not exists (select 1 from t_feed where activity_type = 'offer_updated');
select set_config('request.jwt.claims', '{"sub":"e9bfab1d-5e9a-49d0-af89-5f97ef89b6fe","role":"authenticated"}', true);
update public.offer_letters set field_values = '{"base":4}' where id = (select v from t_ids where k = 'o1');
update public.offer_letters set field_values = '{"base":5}' where id = (select v from t_ids where k = 'o1');
insert into t_results select 'offer: someone else''s burst of edits is one "Offer updated", naming what changed',
  (select count(*) = 1 from t_feed where activity_type = 'offer_updated' and user_id = (select v from t_ids where k = 'support')
     and description = 'Changed: base'));
update public.offer_letters set title = 'Renamed' where id = (select v from t_ids where k = 'o1');
insert into t_results select 'offer: a change that isn''t the offer''s values writes nothing',
  (select count(*) = 1 from t_feed where activity_type = 'offer_updated');

-- ---- Approvals ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated"}', true);
insert into public.offer_approval_requests (id, offer_letter_id, job_id, organization_id, candidate_id, requested_by, status, current_step_order)
select (i->>('r' || n))::uuid, (i->>('o' || n))::uuid, (i->>'job')::uuid, (i->>'org')::uuid, (i->>'cand')::uuid, (i->>'allan')::uuid, 'pending', 1
from t_i, generate_series(1, 3) n;
insert into public.offer_approval_request_steps (id, request_id, approver_user_id, step_order, status)
select (i->>s)::uuid, (i->>r)::uuid, (i->>who)::uuid, n, st
from t_i, (values ('s1', 'r1', 'support', 1, 'pending'), ('s2', 'r1', 'third', 2, 'pending'), ('s3', 'r1', 'allan', 3, 'skipped'),
                  ('s4', 'r2', 'support', 1, 'pending'), ('s5', 'r3', 'third', 1, 'pending')) x(s, r, who, n, st);
insert into t_results select 'approval: sent for approval, once per request, approvers listed without skipped ones',
  (select count(*) = 3 from t_feed where activity_type = 'approval_requested' and user_id = (select v from t_ids where k = 'allan'))
  and (select description from t_feed where activity_type = 'approval_requested' and metadata->>'request_id' = (select v from t_ids where k = 'r1')::text)
      like 'Approvers: %, %'
  and (select description not like '%Allan%' from t_feed where activity_type = 'approval_requested' and metadata->>'request_id' = (select v from t_ids where k = 'r1')::text);

select set_config('request.jwt.claims', '{"sub":"e9bfab1d-5e9a-49d0-af89-5f97ef89b6fe","role":"authenticated"}', true);
update public.offer_approval_request_steps set status = 'approved', notes = 'Within band', decided_at = now() - interval '1 minute'
 where id = (select v from t_ids where k = 's1');
insert into t_results select 'approval: each approval, by the approver, with their note',
  exists (select 1 from t_feed where activity_type = 'approval_approved' and user_id = (select v from t_ids where k = 'support')
          and description = 'Within band' and title = 'Approved the offer');
insert into t_results select 'approval: not "fully approved" while a step is pending',
  not exists (select 1 from t_feed where activity_type = 'approval_completed');
select set_config('request.jwt.claims', '{"sub":"d294b6a2-3736-43f6-b8c3-d85845fcbe89","role":"authenticated"}', true);
update public.offer_approval_request_steps set status = 'approved', decided_at = now() where id = (select v from t_ids where k = 's2');
update public.offer_approval_requests set status = 'approved', current_step_order = 2 where id = (select v from t_ids where k = 'r1');
update public.offer_approval_requests set status = 'pending' where id = (select v from t_ids where k = 'r1');
update public.offer_approval_requests set status = 'approved' where id = (select v from t_ids where k = 'r1');
insert into t_results select 'approval: fully approved once, from the last approver, naming the approvers',
  (select count(*) = 1 from t_feed where activity_type = 'approval_completed' and user_id = (select v from t_ids where k = 'third')
     and description like 'Approved by %, %. Ready to send for signature.');
select set_config('request.jwt.claims', '{"sub":"e9bfab1d-5e9a-49d0-af89-5f97ef89b6fe","role":"authenticated"}', true);
update public.offer_approval_request_steps set status = 'declined', notes = 'Above band' where id = (select v from t_ids where k = 's4');
update public.offer_approval_requests set status = 'declined' where id = (select v from t_ids where k = 'r2');
insert into t_results select 'approval: a decline, with the reason',
  exists (select 1 from t_feed where activity_type = 'approval_declined' and description = 'Above band' and title = 'Declined the offer');
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated"}', true);
update public.offer_approval_requests set status = 'recalled' where id = (select v from t_ids where k = 'r3');
insert into t_results select 'approval: recalled, by the person who recalled it',
  exists (select 1 from t_feed where activity_type = 'approval_recalled' and user_id = (select v from t_ids where k = 'allan'));

-- ---- Gio Sign: an agreement to the candidate and Allan -----------------------------------
select set_config('gio.sign_rpc', 'on', true);
insert into public.sign_envelopes (id, tenant_id, title, kind, template_id, source_type, source_id, origin, sender_name, sender_email,
                                   sender_user_id, created_by, ats_candidate_id, ats_job_id, offer_id, void_reason)
select (i->>'env')::uuid, (i->>'org')::uuid, 'Fake offer letter', 'candidate', (i->>'tpl')::uuid, 'ats_offer', (i->>'o1')::uuid, 'ats',
       'Allan', 'allan@virgilio.tech', (i->>'allan')::uuid, (i->>'allan')::uuid, (i->>'cand')::uuid, (i->>'job')::uuid, (i->>'o1')::uuid,
       'The start date changed'
from t_i;
insert into public.sign_recipients (id, tenant_id, envelope_id, position, role, name, email, color)
select (i->>'rc1')::uuid, (i->>'org')::uuid, (i->>'env')::uuid, 1, 'signer'::public.sign_recipient_role, 'Fake Candidate', 'fake.candidate@example.com', '#6F3FF5' from t_i
union all
select (i->>'rc2')::uuid, (i->>'org')::uuid, (i->>'env')::uuid, 2, 'signer'::public.sign_recipient_role, 'Allan Bravo', 'allan@virgilio.tech', '#0EA5E9' from t_i;
insert into public.sign_events (tenant_id, envelope_id, recipient_id, kind, label, actor_name, actor_user_id, detail)
select (i->>'org')::uuid, (i->>'env')::uuid, (i->>r)::uuid, kind, kind, actor, case when uid then (i->>'allan')::uuid end, '{}'::jsonb
from t_i, (values ('rc1', 'sent', 'Allan', true), ('rc2', 'sent', 'Allan', true), ('rc1', 'consented', null, false),
                  ('rc1', 'opened', 'Fake Candidate', false), ('rc1', 'opened', 'Fake Candidate', false), ('rc1', 'reminded', null, true),
                  ('rc1', 'signed', 'Fake Candidate', false), ('rc2', 'signed', 'Allan Bravo', true), ('rc1', 'sealed', null, false),
                  ('rc1', 'sealed', null, false), ('rc1', 'voided', null, true)) x(r, kind, actor, uid);
insert into t_results select 'sign: sent once per agreement, saying who it went to',
  (select count(*) = 1 from t_feed where activity_type = 'agreement_sent' and description = 'To: Fake Candidate, Allan Bravo'
     and title = 'Sent “Fake offer letter” for signature');
insert into t_results select 'sign: opened, only the first time',
  (select count(*) = 1 from t_feed where activity_type = 'agreement_opened');
insert into t_results select 'sign: the candidate signing is named as who did it',
  exists (select 1 from t_feed where activity_type = 'agreement_signed' and title = 'Fake Candidate signed “Fake offer letter”'
          and metadata->>'author_name' = 'Fake Candidate' and (metadata->>'external_actor')::boolean)
  and exists (select 1 from t_feed where activity_type = 'agreement_signed' and title like 'Allan Bravo signed%'
              and not (metadata ? 'external_actor') and user_id = (select v from t_ids where k = 'allan'));
insert into t_results select 'sign: signed by everyone, once; reminded; voided with the reason',
  (select count(*) = 1 from t_feed where activity_type = 'agreement_completed')
  and exists (select 1 from t_feed where activity_type = 'agreement_reminded' and description = 'To: Fake Candidate')
  and exists (select 1 from t_feed where activity_type = 'agreement_voided' and description = 'The start date changed');
insert into t_results select 'sign: other kinds (consented) write nothing',
  (select count(*) = 7 from t_feed where activity_type::text like 'agreement_%');

-- ---- One job label ----------------------------------------------------------------------
select public.log_activity((select v from t_ids where k = 'allan'), (select v from t_ids where k = 'org'), 'offer_sent', 'Fake legacy entry',
  null, jsonb_build_object('jobId', (select v from t_ids where k = 'job')), 'candidate', (select v from t_ids where k = 'cand'));
insert into t_results select 'job label: a jobId-only entry gets job_id',
  exists (select 1 from public.activities where title = 'Fake legacy entry' and metadata->>'job_id' = (select v from t_ids where k = 'job')::text);
insert into t_results select 'job label: no entry left with jobId but no job_id',
  not exists (select 1 from public.activities where metadata ? 'jobId' and not (metadata ? 'job_id') and coalesce(metadata->>'jobId', '') <> '');

-- ---- What the in-job feed returns (as Allan) ---------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated"}', true);
create temp table t_seen as
  select f.activity_type::text as t from public.get_candidate_activities('26226545-59d7-44b6-8de6-cf9a7e4e51d5', 'cc0428c9-9ac4-433d-96c7-e00dd961cc8a') f
  where f.created_at >= now() - interval '1 second';
reset role;
insert into t_results select 'in-job feed: shows the whole trail, the repaired entry included',
  (select count(distinct t) = 14 from t_seen where t in ('offer_created', 'offer_updated', 'approval_requested', 'approval_approved',
     'approval_declined', 'approval_recalled', 'approval_completed', 'agreement_sent', 'agreement_opened', 'agreement_signed',
     'agreement_completed', 'agreement_reminded', 'agreement_voided', 'offer_sent'));

select check_name as check, ok from t_results;
