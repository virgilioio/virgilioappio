-- Enable job-assigned recruiters to manage all aspects of jobs they're assigned to
-- This migration updates RLS policies on 6 tables to add is_user_assigned_to_job() checks

-- 1. UPDATE jobs table - allow job-assigned users to update jobs
DROP POLICY IF EXISTS "jobs_update_consolidated" ON jobs;

CREATE POLICY "jobs_update_consolidated"
ON jobs
FOR UPDATE
USING (
  (get_user_type_secure() = 'platform_admin')
  OR check_org_hierarchy_role_access(organization_id, 'recruiter'::text)
  OR is_user_assigned_to_job(id)
)
WITH CHECK (
  (get_user_type_secure() = 'platform_admin')
  OR check_org_hierarchy_role_access(organization_id, 'recruiter'::text)
  OR is_user_assigned_to_job(id)
);

COMMENT ON POLICY "jobs_update_consolidated" ON jobs IS 
'Allows org recruiters, platform admins, and job-assigned users to update jobs';

-- 2. UPDATE job_assignments table - allow job-assigned users to manage hiring team
DROP POLICY IF EXISTS "Admins and recruiters can create assignments" ON job_assignments;
DROP POLICY IF EXISTS "Admins and recruiters can delete assignments" ON job_assignments;

CREATE POLICY "job_assignments_insert_consolidated"
ON job_assignments
FOR INSERT
WITH CHECK (
  (get_user_type_secure() = 'platform_admin')
  OR check_org_member_access(organization_id, 'admin'::member_role)
  OR check_org_member_access(organization_id, 'recruiter'::member_role)
  OR is_user_assigned_to_job(job_id)
);

CREATE POLICY "job_assignments_delete_consolidated"
ON job_assignments
FOR DELETE
USING (
  (get_user_type_secure() = 'platform_admin')
  OR check_org_member_access(organization_id, 'admin'::member_role)
  OR check_org_member_access(organization_id, 'recruiter'::member_role)
  OR is_user_assigned_to_job(job_id)
);

COMMENT ON POLICY "job_assignments_insert_consolidated" ON job_assignments IS 
'Allows org admins/recruiters and job-assigned users to add hiring team members';

COMMENT ON POLICY "job_assignments_delete_consolidated" ON job_assignments IS 
'Allows org admins/recruiters and job-assigned users to remove hiring team members';

-- 3. UPDATE job_hiring_stages table - allow job-assigned users to configure stages
DROP POLICY IF EXISTS "job_hiring_stages_insert_consolidated" ON job_hiring_stages;
DROP POLICY IF EXISTS "job_hiring_stages_update_consolidated" ON job_hiring_stages;
DROP POLICY IF EXISTS "job_hiring_stages_delete_consolidated" ON job_hiring_stages;

CREATE POLICY "job_hiring_stages_insert_consolidated"
ON job_hiring_stages
FOR INSERT
WITH CHECK (
  (
    (get_user_type_secure() = 'platform_admin')
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_hiring_stages.job_id
      AND j.organization_id IN (SELECT id FROM get_org_hierarchy(get_platform_tenant_id()))
    )
  )
  OR check_org_hierarchy_role_access(
    (SELECT organization_id FROM jobs WHERE id = job_hiring_stages.job_id),
    'recruiter'::text
  )
  OR is_user_assigned_to_job(job_id)
);

CREATE POLICY "job_hiring_stages_update_consolidated"
ON job_hiring_stages
FOR UPDATE
USING (
  (
    (get_user_type_secure() = 'platform_admin')
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_hiring_stages.job_id
      AND j.organization_id IN (SELECT id FROM get_org_hierarchy(get_platform_tenant_id()))
    )
  )
  OR check_org_hierarchy_role_access(
    (SELECT organization_id FROM jobs WHERE id = job_hiring_stages.job_id),
    'recruiter'::text
  )
  OR is_user_assigned_to_job(job_id)
)
WITH CHECK (
  (
    (get_user_type_secure() = 'platform_admin')
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_hiring_stages.job_id
      AND j.organization_id IN (SELECT id FROM get_org_hierarchy(get_platform_tenant_id()))
    )
  )
  OR check_org_hierarchy_role_access(
    (SELECT organization_id FROM jobs WHERE id = job_hiring_stages.job_id),
    'recruiter'::text
  )
  OR is_user_assigned_to_job(job_id)
);

CREATE POLICY "job_hiring_stages_delete_consolidated"
ON job_hiring_stages
FOR DELETE
USING (
  (
    (get_user_type_secure() = 'platform_admin')
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_hiring_stages.job_id
      AND j.organization_id IN (SELECT id FROM get_org_hierarchy(get_platform_tenant_id()))
    )
  )
  OR check_org_hierarchy_role_access(
    (SELECT organization_id FROM jobs WHERE id = job_hiring_stages.job_id),
    'admin'::text
  )
  OR is_user_assigned_to_job(job_id)
);

COMMENT ON POLICY "job_hiring_stages_insert_consolidated" ON job_hiring_stages IS 
'Allows org recruiters and job-assigned users to create hiring stages';

COMMENT ON POLICY "job_hiring_stages_update_consolidated" ON job_hiring_stages IS 
'Allows org recruiters and job-assigned users to update hiring stages';

COMMENT ON POLICY "job_hiring_stages_delete_consolidated" ON job_hiring_stages IS 
'Allows org admins and job-assigned users to delete hiring stages';

-- 4. ADD policies for stage_interviewer_assignments table (join through job_hiring_stages -> jobs)
DROP POLICY IF EXISTS "Platform admins can manage all stage interviewer assignments - secure" ON stage_interviewer_assignments;

CREATE POLICY "stage_interviewer_assignments_select_consolidated"
ON stage_interviewer_assignments
FOR SELECT
USING (
  (get_user_type_secure() = 'platform_admin')
  OR EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    JOIN jobs j ON j.id = jhs.job_id
    WHERE jhs.id = stage_interviewer_assignments.job_hiring_stage_id
    AND user_has_org_hierarchy_access(j.organization_id)
  )
  OR EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    WHERE jhs.id = stage_interviewer_assignments.job_hiring_stage_id
    AND is_user_assigned_to_job(jhs.job_id)
  )
);

CREATE POLICY "stage_interviewer_assignments_insert_consolidated"
ON stage_interviewer_assignments
FOR INSERT
WITH CHECK (
  (get_user_type_secure() = 'platform_admin')
  OR EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    JOIN jobs j ON j.id = jhs.job_id
    WHERE jhs.id = stage_interviewer_assignments.job_hiring_stage_id
    AND (
      check_org_hierarchy_role_access(j.organization_id, 'admin'::text)
      OR check_org_hierarchy_role_access(j.organization_id, 'recruiter'::text)
    )
  )
  OR EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    WHERE jhs.id = stage_interviewer_assignments.job_hiring_stage_id
    AND is_user_assigned_to_job(jhs.job_id)
  )
);

CREATE POLICY "stage_interviewer_assignments_update_consolidated"
ON stage_interviewer_assignments
FOR UPDATE
USING (
  (get_user_type_secure() = 'platform_admin')
  OR EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    JOIN jobs j ON j.id = jhs.job_id
    WHERE jhs.id = stage_interviewer_assignments.job_hiring_stage_id
    AND (
      check_org_hierarchy_role_access(j.organization_id, 'admin'::text)
      OR check_org_hierarchy_role_access(j.organization_id, 'recruiter'::text)
    )
  )
  OR EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    WHERE jhs.id = stage_interviewer_assignments.job_hiring_stage_id
    AND is_user_assigned_to_job(jhs.job_id)
  )
)
WITH CHECK (
  (get_user_type_secure() = 'platform_admin')
  OR EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    JOIN jobs j ON j.id = jhs.job_id
    WHERE jhs.id = stage_interviewer_assignments.job_hiring_stage_id
    AND (
      check_org_hierarchy_role_access(j.organization_id, 'admin'::text)
      OR check_org_hierarchy_role_access(j.organization_id, 'recruiter'::text)
    )
  )
  OR EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    WHERE jhs.id = stage_interviewer_assignments.job_hiring_stage_id
    AND is_user_assigned_to_job(jhs.job_id)
  )
);

CREATE POLICY "stage_interviewer_assignments_delete_consolidated"
ON stage_interviewer_assignments
FOR DELETE
USING (
  (get_user_type_secure() = 'platform_admin')
  OR EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    JOIN jobs j ON j.id = jhs.job_id
    WHERE jhs.id = stage_interviewer_assignments.job_hiring_stage_id
    AND (
      check_org_hierarchy_role_access(j.organization_id, 'admin'::text)
      OR check_org_hierarchy_role_access(j.organization_id, 'recruiter'::text)
    )
  )
  OR EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    WHERE jhs.id = stage_interviewer_assignments.job_hiring_stage_id
    AND is_user_assigned_to_job(jhs.job_id)
  )
);

COMMENT ON POLICY "stage_interviewer_assignments_select_consolidated" ON stage_interviewer_assignments IS 
'Allows org members and job-assigned users to view stage interviewer assignments';

COMMENT ON POLICY "stage_interviewer_assignments_insert_consolidated" ON stage_interviewer_assignments IS 
'Allows org admins/recruiters and job-assigned users to assign interviewers to stages';

COMMENT ON POLICY "stage_interviewer_assignments_update_consolidated" ON stage_interviewer_assignments IS 
'Allows org admins/recruiters and job-assigned users to update interviewer assignments';

COMMENT ON POLICY "stage_interviewer_assignments_delete_consolidated" ON stage_interviewer_assignments IS 
'Allows org admins/recruiters and job-assigned users to remove interviewer assignments';

-- 5. ADD policies for job_postings table (join through jobs to get organization)
DROP POLICY IF EXISTS "Platform admins can manage all postings - secure" ON job_postings;

CREATE POLICY "job_postings_insert_consolidated"
ON job_postings
FOR INSERT
WITH CHECK (
  (get_user_type_secure() = 'platform_admin')
  OR EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_postings.job_id
    AND check_org_hierarchy_role_access(j.organization_id, 'recruiter'::text)
  )
  OR is_user_assigned_to_job(job_id)
);

CREATE POLICY "job_postings_update_consolidated"
ON job_postings
FOR UPDATE
USING (
  (get_user_type_secure() = 'platform_admin')
  OR EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_postings.job_id
    AND check_org_hierarchy_role_access(j.organization_id, 'recruiter'::text)
  )
  OR is_user_assigned_to_job(job_id)
)
WITH CHECK (
  (get_user_type_secure() = 'platform_admin')
  OR EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_postings.job_id
    AND check_org_hierarchy_role_access(j.organization_id, 'recruiter'::text)
  )
  OR is_user_assigned_to_job(job_id)
);

CREATE POLICY "job_postings_delete_consolidated"
ON job_postings
FOR DELETE
USING (
  (get_user_type_secure() = 'platform_admin')
  OR EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_postings.job_id
    AND check_org_hierarchy_role_access(j.organization_id, 'recruiter'::text)
  )
  OR is_user_assigned_to_job(job_id)
);

COMMENT ON POLICY "job_postings_insert_consolidated" ON job_postings IS 
'Allows org recruiters and job-assigned users to create job postings';

COMMENT ON POLICY "job_postings_update_consolidated" ON job_postings IS 
'Allows org recruiters and job-assigned users to update job postings';

COMMENT ON POLICY "job_postings_delete_consolidated" ON job_postings IS 
'Allows org recruiters and job-assigned users to delete job postings';

-- 6. ADD policies for job_posting_application_fields table (join through postings and jobs)
DROP POLICY IF EXISTS "Platform admins can manage all job posting application fields - secure" ON job_posting_application_fields;

CREATE POLICY "job_posting_application_fields_insert_consolidated"
ON job_posting_application_fields
FOR INSERT
WITH CHECK (
  (get_user_type_secure() = 'platform_admin')
  OR EXISTS (
    SELECT 1 FROM job_postings p
    JOIN jobs j ON j.id = p.job_id
    WHERE p.id = job_posting_application_fields.posting_id
    AND (
      check_org_hierarchy_role_access(j.organization_id, 'recruiter'::text)
      OR is_user_assigned_to_job(p.job_id)
    )
  )
);

CREATE POLICY "job_posting_application_fields_update_consolidated"
ON job_posting_application_fields
FOR UPDATE
USING (
  (get_user_type_secure() = 'platform_admin')
  OR EXISTS (
    SELECT 1 FROM job_postings p
    JOIN jobs j ON j.id = p.job_id
    WHERE p.id = job_posting_application_fields.posting_id
    AND (
      check_org_hierarchy_role_access(j.organization_id, 'recruiter'::text)
      OR is_user_assigned_to_job(p.job_id)
    )
  )
)
WITH CHECK (
  (get_user_type_secure() = 'platform_admin')
  OR EXISTS (
    SELECT 1 FROM job_postings p
    JOIN jobs j ON j.id = p.job_id
    WHERE p.id = job_posting_application_fields.posting_id
    AND (
      check_org_hierarchy_role_access(j.organization_id, 'recruiter'::text)
      OR is_user_assigned_to_job(p.job_id)
    )
  )
);

CREATE POLICY "job_posting_application_fields_delete_consolidated"
ON job_posting_application_fields
FOR DELETE
USING (
  (get_user_type_secure() = 'platform_admin')
  OR EXISTS (
    SELECT 1 FROM job_postings p
    JOIN jobs j ON j.id = p.job_id
    WHERE p.id = job_posting_application_fields.posting_id
    AND (
      check_org_hierarchy_role_access(j.organization_id, 'recruiter'::text)
      OR is_user_assigned_to_job(p.job_id)
    )
  )
);

COMMENT ON POLICY "job_posting_application_fields_insert_consolidated" ON job_posting_application_fields IS 
'Allows org recruiters and job-assigned users to add application fields to postings';

COMMENT ON POLICY "job_posting_application_fields_update_consolidated" ON job_posting_application_fields IS 
'Allows org recruiters and job-assigned users to update application fields';

COMMENT ON POLICY "job_posting_application_fields_delete_consolidated" ON job_posting_application_fields IS 
'Allows org recruiters and job-assigned users to remove application fields';