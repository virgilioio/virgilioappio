-- Run after 20261027184739_offer_approvers_access inside a transaction that is rolled back.
-- Approvers see what they approve and decide it in one go; nobody else gains
-- anything. Uses Leon Kiers' pending request (Sales Development
-- Representative): Erik Veen (hiring manager, a plain member) is step 1,
-- Javier Rodriguez step 2. Jurre Veen is an interviewer on the job and no
-- approver. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated;

do $$
declare
  req constant uuid := '56a7780e-913f-493d-ad3b-a70c5958e199';
  offer constant uuid := '05c8d06f-27e8-490d-b239-83d5b8ab4ce6';
  job constant uuid := '4b881217-ff38-499c-b566-6ec627d9e844';
  erik constant uuid := '71fb2937-3df8-4dfa-b065-aaaa5ee64af8';
  javier constant uuid := 'd294b6a2-3736-43f6-b8c3-d85845fcbe89';
  jurre constant uuid := '7e274af6-466f-41b1-91a5-04b479e6c2ed';
  erik_step uuid;
  javier_step uuid;
  n int;
  res jsonb;
  err text;
begin
  select id into erik_step from public.offer_approval_request_steps where request_id = req and approver_user_id = erik;
  select id into javier_step from public.offer_approval_request_steps where request_id = req and approver_user_id = javier;

  -- 1. Erik, a hiring manager on the chain, sees the request, its steps, the chain and the offer.
  perform set_config('request.jwt.claims', json_build_object('sub', erik, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.offer_approval_requests where id = req;
  insert into t_results values ('an approver sees the request', n = 1);
  select count(*) into n from public.offer_approval_request_steps where request_id = req;
  insert into t_results values ('an approver sees every step of it', n = 4);
  select count(*) into n from public.offer_approval_chains where job_id = job;
  insert into t_results values ('an approver sees the job''s chain', n = 1);
  select count(*) into n from public.offer_approval_chain_steps s join public.offer_approval_chains c on c.id = s.chain_id where c.job_id = job;
  insert into t_results values ('an approver sees the chain''s steps', n > 0);
  select count(*) into n from public.offer_letters where id = offer;
  insert into t_results values ('an approver sees the offer', n = 1);
  perform set_config('role', 'postgres', true);

  -- 2. Jurre, on the job but no approver, still sees no approval.
  perform set_config('request.jwt.claims', json_build_object('sub', jurre, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.offer_approval_requests where id = req;
  insert into t_results values ('someone who isn''t an approver sees no request', n = 0);
  select count(*) into n from public.offer_approval_request_steps where request_id = req;
  insert into t_results values ('nor its steps', n = 0);
  begin
    perform public.offer_approval_decide(erik_step, 'approved', null);
    err := 'none';
  exception when others then err := sqlstate;
  end;
  insert into t_results values ('nor can they decide someone else''s step', err = 'GOA01');
  perform set_config('role', 'postgres', true);

  -- 3. Javier can't approve before Erik.
  perform set_config('request.jwt.claims', json_build_object('sub', javier, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.offer_approval_decide(javier_step, 'approved', null);
    err := 'none';
  exception when others then err := sqlstate;
  end;
  insert into t_results values ('a later approver waits for their turn', err = 'GOA04');
  perform set_config('role', 'postgres', true);

  -- 4. Erik approves: the request moves to Javier; the offer still waits.
  perform set_config('request.jwt.claims', json_build_object('sub', erik, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  res := public.offer_approval_decide(erik_step, 'approved', 'Looks good');
  perform set_config('role', 'postgres', true);
  insert into t_results values ('approving answers with the next step', res->>'request_status' = 'pending' and (res->>'next_step_order')::int = 2);
  insert into t_results values ('the step is approved with its note',
    (select status = 'approved' and notes = 'Looks good' and decided_at is not null from public.offer_approval_request_steps where id = erik_step));
  insert into t_results values ('the request moves to the next approver',
    (select status = 'pending' and current_step_order = 2 from public.offer_approval_requests where id = req));
  insert into t_results values ('the offer is still waiting for approval',
    (select status = 'pending_approval' from public.offer_letters where id = offer));
  perform set_config('request.jwt.claims', json_build_object('sub', erik, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.offer_approval_decide(erik_step, 'approved', null);
    err := 'none';
  exception when others then err := sqlstate;
  end;
  insert into t_results values ('a step is decided once', err = 'GOA03');
  perform set_config('role', 'postgres', true);

  -- 5. Javier declines: the request is declined and the offer goes back to draft.
  perform set_config('request.jwt.claims', json_build_object('sub', javier, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  res := public.offer_approval_decide(javier_step, 'declined', 'Budget');
  perform set_config('role', 'postgres', true);
  insert into t_results values ('declining declines the request',
    res->>'request_status' = 'declined' and (select status = 'declined' from public.offer_approval_requests where id = req));
  insert into t_results values ('and sends the offer back to draft',
    (select status = 'draft' from public.offer_letters where id = offer));

  -- 6. The new rules don't let the browser call the helpers anonymously.
  insert into t_results values ('anon can''t call the decision',
    not has_function_privilege('anon', 'public.offer_approval_decide(uuid, text, text)', 'execute'));
end $$;

-- Raise the results so the whole run rolls back, wherever it runs.
do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n') into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
