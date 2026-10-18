-- Run after 20261018060000_offer_approval_remind inside a transaction that is rolled back.
-- Fake approval requests on a real offer. Allan presses Remind; the support
-- account is the approver being reminded. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert, select on t_results to authenticated;
create temp table t_ids (k text primary key, v uuid);
grant select on t_ids to authenticated;
create temp table t_out (k text, v jsonb, err text);
grant insert, select on t_out to authenticated;
insert into t_ids values ('chain', gen_random_uuid()), ('r1', gen_random_uuid()), ('r2', gen_random_uuid()), ('r3', gen_random_uuid()),
  ('s1', gen_random_uuid()), ('s2', gen_random_uuid()), ('s3', gen_random_uuid());

-- The backfill: the request that was waiting before the notices went live now has its turn email and bell.
insert into t_results select 'backfill: the waiting request got its turn notice',
  exists (select 1 from public.offer_approval_notices where step_id = 'e62ef052-8ed9-4b53-b093-106f448f13f9' and kind = 'turn' and cancelled_at is null);
insert into t_results select 'backfill: and its bell, once',
  (select count(*) from public.notifications where metadata->>'step_id' = 'e62ef052-8ed9-4b53-b093-106f448f13f9' and metadata->>'event' = 'approval_requested') = 1;

do $$
declare
  v_allan uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  v_support uuid := 'e9bfab1d-5e9a-49d0-af89-5f97ef89b6fe';
  v_job uuid := '7d16b23e-0ff0-4583-8ff7-19cdb6fb6e07';
  v_offer uuid := 'c99f2b2c-e8f9-4d1a-b65c-d55fc167e28e';
  v_cand uuid := '26226545-59d7-44b6-8de6-cf9a7e4e51d5';
  -- One pending request per offer: r2 uses another offer on the same job.
  v_offer2 uuid := '45505ac0-5cc8-4e21-9010-31a9c0fb8d57';
  v_cand2 uuid := '621cb82c-4446-4e00-a656-bb69d67438e7';
  v_org uuid;
  v_chain uuid := (select v from t_ids where k = 'chain');
begin
  select organization_id into v_org from public.jobs where id = v_job;
  insert into public.offer_approval_chains (id, job_id, organization_id, is_enabled, created_by, mode, rules)
  values (v_chain, v_job, v_org, true, v_allan, 'sequential', '{"remind24h":true,"autoEscalate":false,"adminOverride":true,"notifyChain":true}')
  on conflict (job_id) do update set mode = 'sequential', rules = excluded.rules;
  -- r1: support first, Allan second (sequential).
  insert into public.offer_approval_requests (id, offer_letter_id, job_id, organization_id, candidate_id, requested_by, status, current_step_order)
  values ((select v from t_ids where k = 'r1'), v_offer, v_job, v_org, v_cand, v_allan, 'pending', 1);
  insert into public.offer_approval_request_steps (id, request_id, approver_user_id, step_order, status) values
    ((select v from t_ids where k = 's1'), (select v from t_ids where k = 'r1'), v_support, 1, 'pending'),
    ((select v from t_ids where k = 's2'), (select v from t_ids where k = 'r1'), v_allan, 2, 'pending');
  -- r2: only Allan, so Allan reminding reminds nobody.
  insert into public.offer_approval_requests (id, offer_letter_id, job_id, organization_id, candidate_id, requested_by, status, current_step_order)
  values ((select v from t_ids where k = 'r2'), v_offer2, v_job, v_org, v_cand2, v_allan, 'pending', 1);
  insert into public.offer_approval_request_steps (id, request_id, approver_user_id, step_order, status) values
    ((select v from t_ids where k = 's3'), (select v from t_ids where k = 'r2'), v_allan, 1, 'pending');
  -- r3: already declined.
  insert into public.offer_approval_requests (id, offer_letter_id, job_id, organization_id, candidate_id, requested_by, status, current_step_order)
  values ((select v from t_ids where k = 'r3'), v_offer, v_job, v_org, v_cand, v_allan, 'declined', 1);
end $$;

-- ---- Allan presses Remind -----------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);
insert into t_out select 'first', public.offer_approval_remind((select v from t_ids where k = 'r1')), null;
insert into t_out select 'again', public.offer_approval_remind((select v from t_ids where k = 'r1')), null;
insert into t_out select 'self', public.offer_approval_remind((select v from t_ids where k = 'r2')), null;
do $$
begin
  perform public.offer_approval_remind((select v from t_ids where k = 'r3'));
  insert into t_out select 'declined', null, 'none';
exception when others then
  insert into t_out select 'declined', null, sqlstate;
end $$;
reset role;

insert into t_results select 'remind: the approver whose turn it is is reminded',
  (select jsonb_array_length(v->'reminded') = 1 and (v->>'wait_minutes')::int = 0 from t_out where k = 'first');
insert into t_results select 'remind: queues a reminder email marked with who pressed it',
  exists (select 1 from public.offer_approval_notices where step_id = (select v from t_ids where k = 's1') and kind = 'reminder'
          and nudged_by = '7acbeead-b1b8-442c-b316-bff9779dc7de' and sent_at is null and cancelled_at is null);
insert into t_results select 'remind: rings the approver''s bell',
  exists (select 1 from public.notifications where user_id = 'e9bfab1d-5e9a-49d0-af89-5f97ef89b6fe'
          and metadata->>'event' = 'approval_reminder' and metadata->>'step_id' = (select v from t_ids where k = 's1')::text);
insert into t_results select 'remind: the next approver in a sequential chain isn''t reminded yet',
  not exists (select 1 from public.offer_approval_notices where step_id = (select v from t_ids where k = 's2'));
insert into t_results select 'remind: again within the hour waits',
  (select jsonb_array_length(v->'reminded') = 0 and (v->>'wait_minutes')::int between 1 and 60 from t_out where k = 'again');
insert into t_results select 'remind: never reminds the person pressing it',
  (select jsonb_array_length(v->'reminded') = 0 from t_out where k = 'self');
insert into t_results select 'remind: a decided request says so', (select err = 'GOA02' from t_out where k = 'declined');

-- The minute job sends it, saying who reminded.
do $$
declare
  c record;
  v_found boolean := false;
begin
  for c in select * from public.offer_approval_claim_notices_v2(200) loop
    if c.kind = 'reminder' and c.nudged_by_name is not null and c.approver_email = 'support@virgilio.tech' then
      v_found := true;
    end if;
  end loop;
  insert into t_results select 'claim v2: the reminder comes with who sent it', v_found;
end $$;

-- An hour later, Remind works again (and queues the same notice afresh).
update public.offer_approval_notices set created_at = now() - interval '61 minutes', sent_at = now() - interval '60 minutes', claimed_at = null
where step_id = (select v from t_ids where k = 's1') and kind = 'reminder';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7acbeead-b1b8-442c-b316-bff9779dc7de","role":"authenticated","email":"allan@virgilio.tech"}', true);
insert into t_out select 'later', public.offer_approval_remind((select v from t_ids where k = 'r1')), null;
-- Someone with no access to the offer.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
begin
  perform public.offer_approval_remind((select v from t_ids where k = 'r1'));
  insert into t_out select 'stranger', null, 'none';
exception when others then
  insert into t_out select 'stranger', null, sqlstate;
end $$;
reset role;

insert into t_results select 'remind: works again after an hour',
  (select jsonb_array_length(v->'reminded') = 1 from t_out where k = 'later')
  and exists (select 1 from public.offer_approval_notices where step_id = (select v from t_ids where k = 's1') and kind = 'reminder' and sent_at is null and attempts = 0);
insert into t_results select 'remind: not for someone who can''t see the offer', (select err = 'GOA01' from t_out where k = 'stranger');
insert into t_results select 'grants: signed-in users can remind, signed-out can''t',
  has_function_privilege('authenticated', 'public.offer_approval_remind(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.offer_approval_remind(uuid)', 'execute');
insert into t_results select 'grants: claim v2 is the minute job''s only',
  not has_function_privilege('authenticated', 'public.offer_approval_claim_notices_v2(int)', 'execute');

select check_name as check, ok from t_results;
