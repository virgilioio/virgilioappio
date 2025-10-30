-- Restore missing SELECT policies on jobs table
-- These were accidentally dropped by CASCADE when recreating check_org_member_access function

-- Policy 1: Allow users to view jobs in their organization hierarchy
-- Excludes recruiters (they only see assigned jobs via is_user_assigned_to_job)
CREATE POLICY "Users can view jobs in their organization" ON public.jobs
FOR SELECT
USING (
  (get_user_type_secure() = 'platform_admin')
  OR is_user_assigned_to_job(id)
  OR (
    user_has_org_hierarchy_access(organization_id)
    AND NOT (check_org_member_access(organization_id, 'recruiter'::member_role))
  )
);

-- Policy 2: Special policy for Virgilio.tech platform vs SaaS customers
-- Virgilio.tech users see entire hierarchy (except recruiters)
-- SaaS customers only see their own org
CREATE POLICY "jobs_virgilio_hierarchy_exclude_saas" ON public.jobs
FOR SELECT
USING (
  (
    (lower(split_part(get_user_email(), '@', 2)) = 'virgilio.tech')
    AND (organization_id IN (SELECT id FROM get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab')))
    AND NOT (check_org_member_access(organization_id, 'recruiter'::member_role))
  )
  OR
  (
    (lower(split_part(get_user_email(), '@', 2)) <> 'virgilio.tech')
    AND (organization_id = get_user_organization_id())
  )
);

-- Add comments for documentation
COMMENT ON POLICY "Users can view jobs in their organization" ON public.jobs IS
'Allows users to view jobs in their organization hierarchy. Recruiters only see jobs they are assigned to via is_user_assigned_to_job.';

COMMENT ON POLICY "jobs_virgilio_hierarchy_exclude_saas" ON public.jobs IS
'Platform admins from virgilio.tech can see hierarchy jobs (excluding recruiter role). SaaS customers only see their own org jobs.';