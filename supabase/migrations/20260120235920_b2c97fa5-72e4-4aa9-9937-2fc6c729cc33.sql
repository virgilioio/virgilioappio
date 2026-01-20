-- Drop the current policy
DROP POLICY IF EXISTS jobs_select_consolidated ON public.jobs;

-- Create updated policy with role-based access
-- Platform admins, workspace owners, admins, and recruiters see all jobs in org hierarchy
-- Hiring managers and interviewers ONLY see jobs they're assigned to
CREATE POLICY "jobs_select_consolidated" 
ON public.jobs
FOR SELECT
USING (
  (deleted_at IS NULL) 
  AND (
    -- Platform admins see all jobs in tenant
    get_user_type_secure() = 'platform_admin'
    OR
    -- Workspace owners, admins, and recruiters see all jobs in org hierarchy
    check_org_hierarchy_role_access(organization_id, 'recruiter')
    OR
    -- Hiring managers and interviewers ONLY see jobs they're assigned to
    is_user_assigned_to_job(id)
  )
);

-- Add comment for documentation
COMMENT ON POLICY "jobs_select_consolidated" ON public.jobs IS 
'Platform admins, workspace owners, admins, and recruiters can view all jobs in their org hierarchy. Hiring managers and interviewers can only view jobs they are assigned to.';