-- Run after 20261017200100_offer_approval_notices inside a transaction that is rolled back.
-- Fake approval requests on a real offer; Allan is every approver (his push is off).
create temp table t_results (check_name text, ok boolean);
create temp table t_ids (k text primary key, v uuid);
insert into t_ids values ('chain', gen_random_uuid()), ('req1', gen_random_uuid()), ('req2', gen_random_uuid()), ('req3', gen_random_uuid());

do $$
declare
  v_allan uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  v_job uuid := '7d16b23e-0ff0-4583-8ff7-19cdb6fb6e07';
  v_offer uuid := 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e';
  v_cand uuid := '26226545-59d7-44b6-8de6-cf9a7e4e51d5';
  v_org uuid;
  v_chain uuid := (select v from t_ids where k = 'chain');
  r1 uuid := (select v from t_ids where k = 'req1');
  r2 uuid := (select v from t_ids where k = 'req2');
  r3 uuid := (select v from t_ids where k = 'req3');
  s1 uuid := gen_random_uuid();
  s2 uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid();
  p2 uuid := gen_random_uuid();
  v_rows int;
  v_claimed record;
begin
  select organization_id into v_org from public.jobs where id = v_job;
  -- The job's chain (made or changed only inside this transaction).
  insert into public.offer_approval_chains (id, job_id, organization_id, is_enabled, created_by, mode, rules)
  values (v_chain, v_job, v_org, true, v_allan, 'sequential', '{"remind24h":true,"autoEscalate":false,"adminOverride":true,"notifyChain":true}')
  on conflict (job_id) do update set mode = 'sequential', rules = excluded.rules
  returning id into v_chain;

  -- Sequential: only the first step's approver is told.
  insert into public.offer_approval_requests (id, offer_letter_id, job_id, organization_id, candidate_id, requested_by, status, current_step_order)
  values (r1, v_offer, v_job, v_org, v_cand, v_allan, 'pending', 1);
  insert into public.offer_approval_request_steps (id, request_id, approver_user_id, step_order, status) values
    (s1, r1, v_allan, 1, 'pending'), (s2, r1, v_allan, 2, 'pending');
  insert into t_results select 'sequential: first step noticed', exists (select 1 from public.offer_approval_notices where step_id = s1 and kind = 'turn');
  insert into t_results select 'sequential: second step waits', not exists (select 1 from public.offer_approval_notices where step_id = s2);
  insert into t_results select 'bell: rung once for the turn',
    (select count(*) from public.notifications where metadata->>'step_id' = s1::text) = 1;

  -- The first approves: the second's turn; the first's unsent email is dropped.
  update public.offer_approval_request_steps set status = 'approved', decided_at = now() where id = s1;
  update public.offer_approval_requests set current_step_order = 2 where id = r1;
  insert into t_results select 'sequential: next step noticed after approval', exists (select 1 from public.offer_approval_notices where step_id = s2 and kind = 'turn' and cancelled_at is null);
  insert into t_results select 'decided step: unsent email cancelled', exists (select 1 from public.offer_approval_notices where step_id = s1 and cancelled_at is not null);

  -- Claiming returns what the email needs; finishing marks it sent.
  select * into v_claimed from public.offer_approval_claim_notices(50) c limit 1;
  insert into t_results select 'claim: returns the open turn with an email', v_claimed.notice_id is not null and v_claimed.approver_email = 'allan@virgilio.tech' and v_claimed.job_id = v_job;
  perform public.offer_approval_finish_notice(v_claimed.notice_id, true);
  insert into t_results select 'finish: marked sent', exists (select 1 from public.offer_approval_notices where id = v_claimed.notice_id and sent_at is not null);
  insert into t_results select 'claim: nothing left', not exists (select 1 from public.offer_approval_claim_notices(50));

  -- A day later without a decision: one reminder.
  update public.offer_approval_notices set sent_at = now() - interval '25 hours' where id = v_claimed.notice_id;
  select public.offer_approval_queue_reminders() into v_rows;
  insert into t_results select 'reminder: queued once after a day', v_rows = 1 and public.offer_approval_queue_reminders() = 0;

  -- Recalled: the unsent reminder is cancelled.
  update public.offer_approval_request_steps set status = 'recalled' where request_id = r1 and status = 'pending';
  update public.offer_approval_requests set status = 'recalled' where id = r1;
  insert into t_results select 'recall: unsent notices cancelled',
    not exists (select 1 from public.offer_approval_notices where request_id = r1 and sent_at is null and cancelled_at is null);

  -- Parallel: everyone pending is told at once.
  update public.offer_approval_chains set mode = 'parallel' where id = v_chain;
  insert into public.offer_approval_requests (id, offer_letter_id, job_id, organization_id, candidate_id, requested_by, status, current_step_order)
  values (r2, v_offer, v_job, v_org, v_cand, v_allan, 'pending', 1);
  insert into public.offer_approval_request_steps (id, request_id, approver_user_id, step_order, status) values
    (p1, r2, v_allan, 1, 'pending'), (p2, r2, v_allan, 2, 'pending');
  insert into t_results select 'parallel: every pending step noticed', (select count(*) from public.offer_approval_notices where request_id = r2 and kind = 'turn') = 2;
  update public.offer_approval_requests set status = 'declined' where id = r2;
  insert into t_results select 'declined: nothing left to send',
    not exists (select 1 from public.offer_approval_notices where request_id = r2 and sent_at is null and cancelled_at is null);

  -- notifyChain off: nobody is told.
  update public.offer_approval_chains set rules = rules || '{"notifyChain":false}' where id = v_chain;
  insert into public.offer_approval_requests (id, offer_letter_id, job_id, organization_id, candidate_id, requested_by, status, current_step_order)
  values (r3, v_offer, v_job, v_org, v_cand, v_allan, 'pending', 1);
  insert into public.offer_approval_request_steps (request_id, approver_user_id, step_order, status) values (r3, v_allan, 1, 'pending');
  insert into t_results select 'notifyChain off: no notice', not exists (select 1 from public.offer_approval_notices where request_id = r3);
end $$;

insert into t_results select 'outbox: signed-in users can''t read it',
  not has_table_privilege('authenticated', 'public.offer_approval_notices', 'select');
insert into t_results select 'claim: not for signed-in users',
  not has_function_privilege('authenticated', 'public.offer_approval_claim_notices(int)', 'execute');
insert into t_results select 'cron: job scheduled', exists (select 1 from cron.job where jobname = 'offer-approval-notify');

select check_name as check, ok from t_results;
