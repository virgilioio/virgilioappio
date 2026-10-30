-- Offers are for the people who make and approve them (Allan, 2026-10-27).
--
-- A job's offers, their approvals and the candidate's Gio Sign agreements on
-- that job carry the pay. Until now they were read by anyone with a seat on
-- the job (interviewers and sourcers included) and, through the talent-pool
-- rule, by anyone holding a Recruiter or Sourcer seat on any open job, for
-- every job in the workspace.
--
-- Now one rule, can_view_job_offers(job), decides who sees them:
--   * admins (platform admins, workspace owners, the workspace's admins);
--   * the job's Recruiter and Hiring manager seats (external hiring managers
--     included);
--   * plus, through the policies added in 20261027184739, the approvers on an
--     offer's approval request (the request, its steps, the chain, the offer).
-- Interviewers, sourcers and members with no seat on the job see none of it.
--
-- What follows the rule:
--   * offer_letters: reading; creating and changing also need it, on top of
--     the workspace role they already needed (restrictive policies, so the
--     old rules stay and nothing is removed);
--   * offer_approval_requests and their steps: reading (the job's Hiring
--     manager now sees the approval too), creating, changing;
--   * Gio Sign agreements tied to a job (documents, signers, sealed PDFs all
--     read through sign_can_view_envelope) and sending one for a candidate;
--   * the candidate's activity feed leaves out offer, approval and agreement
--     entries for people who can't see the job's offers.
-- Chains (who approves, no pay) and everything else are unchanged.

create or replace function public.can_view_job_offers(_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.jobs j
    where j.id = _job_id
      and (
        public.get_user_type_secure() = 'platform_admin'
        or exists (
          select 1 from public.members m
          where m.tenant_id = j.tenant_id
            and m.user_id = auth.uid()
            and m.user_status = 'active'
            and (m.user_type in ('workspace_owner', 'platform_admin') or m.system_role = 'admin'))
        or exists (
          select 1 from public.job_assignments ja
          join public.members m on m.user_id = ja.user_id and m.tenant_id = j.tenant_id and m.user_status = 'active'
          where ja.job_id = j.id
            and ja.user_id = auth.uid()
            and ja.deleted_at is null
            and ja.role in ('recruiter', 'hiring_manager'))
      ));
$function$;

revoke all on function public.can_view_job_offers(uuid) from public, anon;
grant execute on function public.can_view_job_offers(uuid) to authenticated;

-- Offers. The old read rules stay; a restrictive rule now has to pass too, so
-- nothing is removed. The offer team also gets its own read rule (a Hiring
-- manager reads through the old seat rule, an admin through the workspace one).
create policy "The job's offer team can view its offers" on public.offer_letters
  for select to authenticated
  using (public.can_view_job_offers(job_id));

create policy "Only the offer team and approvers read offers" on public.offer_letters
  as restrictive for select to authenticated
  using (public.can_view_job_offers(job_id) or public.offer_letter_is_approver(id));

create policy "Only the offer team creates offers" on public.offer_letters
  as restrictive for insert to authenticated
  with check (public.can_view_job_offers(job_id));

create policy "Only the offer team changes offers" on public.offer_letters
  as restrictive for update to authenticated
  using (public.can_view_job_offers(job_id))
  with check (public.can_view_job_offers(job_id));

-- Approval requests.
create policy "The job's offer team can view approval requests" on public.offer_approval_requests
  for select to authenticated
  using (public.can_view_job_offers(job_id));

create policy "Only the offer team and approvers read approval requests" on public.offer_approval_requests
  as restrictive for select to authenticated
  using (public.can_view_job_offers(job_id) or public.offer_approval_is_approver(id));

create policy "Only the offer team creates approval requests" on public.offer_approval_requests
  as restrictive for insert to authenticated
  with check (public.can_view_job_offers(job_id));

create policy "Only the offer team changes approval requests" on public.offer_approval_requests
  as restrictive for update to authenticated
  using (public.can_view_job_offers(job_id))
  with check (public.can_view_job_offers(job_id));

-- Their steps.
create or replace function public.offer_approval_request_offer_team(_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.offer_approval_requests r
    where r.id = _request_id and public.can_view_job_offers(r.job_id));
$function$;

revoke all on function public.offer_approval_request_offer_team(uuid) from public, anon;
grant execute on function public.offer_approval_request_offer_team(uuid) to authenticated;

create policy "The job's offer team can view approval steps" on public.offer_approval_request_steps
  for select to authenticated
  using (public.offer_approval_request_offer_team(request_id));

create policy "Only the offer team and approvers read approval steps" on public.offer_approval_request_steps
  as restrictive for select to authenticated
  using (public.offer_approval_request_offer_team(request_id) or public.offer_approval_is_approver(request_id));

create policy "Only the offer team creates approval steps" on public.offer_approval_request_steps
  as restrictive for insert to authenticated
  with check (public.offer_approval_request_offer_team(request_id));

-- Gio Sign: agreements tied to a job follow the same rule (the offer's
-- agreement carries the pay, and a candidate's other agreements draw on the
-- offer's values). The sender, the creator, admins and signers keep theirs.
create or replace function public.sign_can_view_envelope(_envelope_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.sign_envelopes e
    where e.id = _envelope_id
      and public.is_active_member(e.tenant_id)
      and (
        public.sign_is_admin(e.tenant_id)
        or e.created_by = auth.uid()
        or e.sender_user_id = auth.uid()
        or (e.ats_job_id is not null and public.can_view_job_offers(e.ats_job_id))
        or exists (
          select 1 from public.sign_recipients r
          where r.envelope_id = e.id and r.removed_at is null
            and (r.user_id = auth.uid() or r.email = public.sign_my_email())
        )
      )
  );
$function$;

create or replace function public.sign_can_send(_tenant_id uuid, _kind sign_kind, _job_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.is_active_member(_tenant_id)
     and (public.sign_is_admin(_tenant_id)
          or (_kind = 'candidate' and _job_id is not null and public.can_view_job_offers(_job_id)));
$function$;

-- The candidate's activity feed: offer, approval and agreement entries only
-- for the job's offer team.
create or replace function public.get_candidate_activities(p_candidate_id uuid, p_job_id uuid default null::uuid)
returns table(id uuid, user_id uuid, organization_id uuid, activity_type activity_type, title text, description text, metadata jsonb, entity_type text, entity_id uuid, created_at timestamp with time zone, author_first_name text, author_last_name text, author_email text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
DECLARE
  v_org_id UUID;
  v_user_type TEXT;
  v_has_access BOOLEAN;
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT c.organization_id INTO v_org_id FROM public.candidates c WHERE c.id = p_candidate_id;
  IF v_org_id IS NULL THEN
    SELECT j.organization_id INTO v_org_id
    FROM public.job_candidate_associations jca
    JOIN public.jobs j ON j.id = jca.job_id
    WHERE jca.candidate_id = p_candidate_id
    LIMIT 1;
  END IF;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Candidate not found or has no organization: %', p_candidate_id;
  END IF;

  v_user_type := public.get_user_type_secure();
  v_has_access := public.user_has_org_hierarchy_access(v_org_id);
  IF NOT (v_user_type = 'platform_admin' OR v_has_access) THEN
    RAISE EXCEPTION 'Access denied to candidate activities. User: %, Candidate Org: %, User Type: %, Has Access: %',
      v_current_user, v_org_id, v_user_type, v_has_access;
  END IF;

  RETURN QUERY
  WITH matched AS (
    SELECT a.id, a.user_id, a.organization_id, a.activity_type, a.title, a.description,
           a.metadata, a.entity_type, a.entity_id, a.created_at
    FROM public.activities a
    WHERE a.entity_id = p_candidate_id
      AND a.entity_type = 'candidate'
      AND (p_job_id IS NULL OR a.metadata @> jsonb_build_object('job_id', p_job_id::text))
    UNION
    SELECT a.id, a.user_id, a.organization_id, a.activity_type, a.title, a.description,
           a.metadata, a.entity_type, a.entity_id, a.created_at
    FROM public.activities a
    WHERE a.metadata @> jsonb_build_object('candidate_id', p_candidate_id::text)
      AND (p_job_id IS NULL OR a.metadata @> jsonb_build_object('job_id', p_job_id::text))
    UNION
    -- Email activities whose linked email record belongs to the job, even when the
    -- activity metadata itself never recorded job_id.
    SELECT a.id, a.user_id, a.organization_id, a.activity_type, a.title, a.description,
           a.metadata, a.entity_type, a.entity_id, a.created_at
    FROM public.activities a
    JOIN public.email_logs e
      ON e.id::text = a.metadata->>'email_log_id'
    WHERE p_job_id IS NOT NULL
      AND a.entity_id = p_candidate_id
      AND a.entity_type = 'candidate'
      AND a.activity_type IN ('candidate_email_sent','candidate_email_received','candidate_email_automated')
      AND e.candidate_id = p_candidate_id
      AND e.job_id = p_job_id
  )
  SELECT
    m.id, m.user_id, m.organization_id, m.activity_type, m.title, m.description,
    m.metadata, m.entity_type, m.entity_id, m.created_at,
    p.first_name AS author_first_name,
    p.last_name AS author_last_name,
    COALESCE(p.email, '') AS author_email
  FROM matched m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE NOT (
      coalesce(m.metadata->>'source', '') = 'offer_trail'
      OR m.activity_type::text ~ '^(offer_|approval_|agreement_)'
    )
    OR (m.metadata->>'job_id' ~ '^[0-9a-f-]{36}$'
        AND public.can_view_job_offers((m.metadata->>'job_id')::uuid))
  ORDER BY m.created_at DESC;
END;
$function$;
