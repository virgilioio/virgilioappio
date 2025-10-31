-- Add RLS policies to job_assignments table to allow recruiters to see their assigned jobs

-- Policy 1: Users can view their own job assignments
-- This allows is_user_assigned_to_job() to work for all users
CREATE POLICY "Users can view their own assignments"
ON public.job_assignments
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy 2: Scoped platform admin SELECT (matching jobs table pattern)
-- Platform admins can only view assignments within their org hierarchy
CREATE POLICY "job_assignments_platform_admin_select"
ON public.job_assignments
FOR SELECT
TO authenticated
USING (
  (get_user_type_secure() = 'platform_admin')
  AND (organization_id IN (
    SELECT id FROM get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab')
  ))
);

-- Policy 3: Admins and recruiters can view org assignments
-- Organization admins and recruiters can view assignments within their organization
CREATE POLICY "Admins and recruiters can view org assignments"
ON public.job_assignments
FOR SELECT
TO authenticated
USING (
  check_org_member_access(organization_id, 'admin')
  OR check_org_member_access(organization_id, 'recruiter')
);

-- Policy 4: Admins and recruiters can create assignments
CREATE POLICY "Admins and recruiters can create assignments"
ON public.job_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR check_org_member_access(organization_id, 'admin')
  OR check_org_member_access(organization_id, 'recruiter')
);

-- Policy 5: Admins and recruiters can delete assignments
CREATE POLICY "Admins and recruiters can delete assignments"
ON public.job_assignments
FOR DELETE
TO authenticated
USING (
  get_user_type_secure() = 'platform_admin'
  OR check_org_member_access(organization_id, 'admin')
  OR check_org_member_access(organization_id, 'recruiter')
);