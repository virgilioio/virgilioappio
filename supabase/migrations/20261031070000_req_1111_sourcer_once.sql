-- One-time exception (Allan, 2026-10-31): Javier Rodriguez is the Sourcer on
-- REQ-1111 (Vanessa Crisostomo), as well as its Recruiter, the deal's Sales
-- and its Engagement Specialist. The crediting rules don't change: Change
-- credit still requires a Sourcer seat on the job, and one seat per person per
-- job stays. This writes the one hire directly, as only a migration can (the
-- guard lets the database owner through), and only while the Sourcer is still
-- Virgilio Success.
--
-- job_openings_sales_events sends opening.credit_changed to Gio Sales, which
-- updates the opening there, so R-1014 credits Javier as Sourcer when Billing
-- issues it. Nothing is marked paid.
--
-- Dry run (rolled back, 2026-10-31): sourcer=javier recruiter=javier activity=1
-- outbox=opening.credit_changed → gio_sales with Javier as Sourcer.

with changed as (
  update public.job_openings
     set sourcer_user_id = 'd294b6a2-3736-43f6-b8c3-d85845fcbe89',  -- Javier Rodriguez
         updated_at = now()
   where id = '74f007fc-862f-4ecc-b289-4c61752839c1'                 -- REQ-1111
     and req_id = 'REQ-1111'
     and sourcer_user_id = 'a498e5bd-dfd9-4830-b4f3-a9a2570f96d0'    -- Virgilio Success
     and hired_association_id is not null
  returning id, job_id, req_id, hired_association_id, recruiter_user_id
)
insert into public.activities (user_id, organization_id, activity_type, title, description, metadata, entity_type, entity_id)
select '7acbeead-b1b8-442c-b316-bff9779dc7de',                         -- Allan Bravo
       'a4f63aba-8e2b-44ca-8b66-d3c148d3ec76',
       'candidate_status_changed',
       'Hire credit changed · ' || c.req_id,
       'Sourcer: Virgilio Success → Javier Rodriguez. A one-time exception approved by Allan Bravo.',
       jsonb_build_object('candidateId', 'e0e0d5de-448c-4da9-998f-9db5beecfa35', 'jobId', c.job_id,
                          'associationId', c.hired_association_id, 'openingId', c.id, 'reqId', c.req_id,
                          'sourcerId', 'd294b6a2-3736-43f6-b8c3-d85845fcbe89', 'recruiterId', c.recruiter_user_id,
                          'previousSourcerId', 'a498e5bd-dfd9-4830-b4f3-a9a2570f96d0',
                          'previousRecruiterId', c.recruiter_user_id),
       'candidate',
       'e0e0d5de-448c-4da9-998f-9db5beecfa35'
  from changed c;
