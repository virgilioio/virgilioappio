-- Drop existing jobs_select_consolidated policy
DROP POLICY IF EXISTS "jobs_select_consolidated" ON public.jobs;

-- Create updated policy: Recruiters only see assigned jobs
CREATE POLICY "jobs_select_consolidated"
ON public.jobs
FOR SELECT
USING (
  -- Platform admins see everything
  get_user_type_secure() = 'platform_admin'
  OR
  -- Workspace owners and admins see all jobs in their hierarchy (but NOT recruiters)
  (user_has_org_hierarchy_access(organization_id)
   AND NOT check_org_member_access(organization_id, 'recruiter'::member_role))
  OR
  -- Everyone (including recruiters) can see jobs they're assigned to
  is_user_assigned_to_job(id)
);