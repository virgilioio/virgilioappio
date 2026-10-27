-- Approvers can see and decide what they approve (Allan, 2026-10-27).
--
-- An offer's approvers were picked from the job's team, but reading an
-- approval request, its steps and the job's chain needed a workspace role of
-- interviewer (requests) or recruiter (chains). A hiring manager who is a plain
-- member saw nothing and had no Approve button. And approving ran from the
-- browser in three writes (the step, the request, the offer) where only the
-- first was allowed for them; the others changed nothing without an error, so
-- the request stayed on their step.
--
-- Now:
--   * an approver on a request reads that request, all its steps, the job's
--     approval chain and the offer itself (nothing else changes for anyone);
--   * offer_approval_decide(step, decision, notes) records a decision in one
--     go: only the step's approver, only on their turn (any pending step in a
--     parallel chain), only while the request is open. Approve moves the
--     request to the next approver or, after the last one, approves the
--     request and the offer; decline declines the request and sends the offer
--     back to draft, as the screen did before.

-- Who is an approver, read without the callers' own row rules.
create or replace function public.offer_approval_is_approver(_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.offer_approval_request_steps s
    where s.request_id = _request_id and s.approver_user_id = auth.uid());
$function$;

create or replace function public.offer_chain_is_approver(_chain_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.offer_approval_chain_steps s
    where s.chain_id = _chain_id and s.approver_user_id = auth.uid())
  or exists (
    select 1 from public.offer_approval_chains c
    join public.offer_approval_requests r on r.job_id = c.job_id
    join public.offer_approval_request_steps s on s.request_id = r.id
    where c.id = _chain_id and s.approver_user_id = auth.uid());
$function$;

create or replace function public.offer_letter_is_approver(_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.offer_approval_requests r
    join public.offer_approval_request_steps s on s.request_id = r.id
    where r.offer_letter_id = _offer_id and s.approver_user_id = auth.uid());
$function$;

revoke all on function public.offer_approval_is_approver(uuid) from public, anon;
revoke all on function public.offer_chain_is_approver(uuid) from public, anon;
revoke all on function public.offer_letter_is_approver(uuid) from public, anon;
grant execute on function public.offer_approval_is_approver(uuid) to authenticated;
grant execute on function public.offer_chain_is_approver(uuid) to authenticated;
grant execute on function public.offer_letter_is_approver(uuid) to authenticated;

create policy "Approvers can view their approval requests" on public.offer_approval_requests
  for select to authenticated
  using (public.offer_approval_is_approver(id));

create policy "Approvers can view the steps of their approval requests" on public.offer_approval_request_steps
  for select to authenticated
  using (public.offer_approval_is_approver(request_id));

create policy "Approvers can view the approval chain" on public.offer_approval_chains
  for select to authenticated
  using (public.offer_chain_is_approver(id));

create policy "Approvers can view the approval chain steps" on public.offer_approval_chain_steps
  for select to authenticated
  using (public.offer_chain_is_approver(chain_id));

create policy "Approvers can view the offers they approve" on public.offer_letters
  for select to authenticated
  using (public.offer_letter_is_approver(id));

-- One decision, all its effects.
create or replace function public.offer_approval_decide(_step_id uuid, _decision text, _notes text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  st public.offer_approval_request_steps;
  q public.offer_approval_requests;
  v_mode text;
  v_turn int;
  v_next int;
begin
  if me is null then
    raise exception 'Sign in to do this.' using errcode = 'GOA01';
  end if;
  if _decision is null or _decision not in ('approved', 'declined') then
    raise exception 'Choose to approve or decline.' using errcode = 'GOA02';
  end if;

  select * into st from public.offer_approval_request_steps where id = _step_id for update;
  if st.id is null or st.approver_user_id is distinct from me then
    raise exception 'This approval step isn''t yours.' using errcode = 'GOA01';
  end if;
  select * into q from public.offer_approval_requests where id = st.request_id for update;
  if q.status is distinct from 'pending' then
    raise exception 'This approval request is no longer open.' using errcode = 'GOA03';
  end if;
  if st.status is distinct from 'pending' then
    raise exception 'You''ve already decided on this step.' using errcode = 'GOA03';
  end if;

  select c.mode into v_mode from public.offer_approval_chains c where c.job_id = q.job_id;
  if coalesce(v_mode, 'sequential') <> 'parallel' then
    select min(s.step_order) into v_turn from public.offer_approval_request_steps s
    where s.request_id = q.id and s.status = 'pending';
    if st.step_order is distinct from v_turn then
      raise exception 'It isn''t your turn yet: an earlier approver still has to decide.' using errcode = 'GOA04';
    end if;
  end if;

  update public.offer_approval_request_steps
     set status = _decision, notes = nullif(btrim(coalesce(_notes, '')), ''), decided_at = now()
   where id = st.id;

  if _decision = 'declined' then
    update public.offer_approval_requests set status = 'declined' where id = q.id;
    update public.offer_letters set status = 'draft' where id = q.offer_letter_id;
    return jsonb_build_object('request_status', 'declined');
  end if;

  select min(s.step_order) into v_next from public.offer_approval_request_steps s
  where s.request_id = q.id and s.status = 'pending';
  if v_next is null then
    update public.offer_approval_requests set status = 'approved', current_step_order = st.step_order where id = q.id;
    update public.offer_letters set status = 'approved' where id = q.offer_letter_id;
    return jsonb_build_object('request_status', 'approved');
  end if;

  update public.offer_approval_requests set current_step_order = v_next where id = q.id;
  return jsonb_build_object('request_status', 'pending', 'next_step_order', v_next);
end;
$function$;

revoke all on function public.offer_approval_decide(uuid, text, text) from public, anon;
grant execute on function public.offer_approval_decide(uuid, text, text) to authenticated;
