
-- Drop and recreate the jobs_select_with_assignments policy to ensure it includes assignment access
DROP POLICY IF EXISTS "jobs_select_with_assignments" ON public.jobs;

CREATE POLICY "jobs_select_with_assignments" ON public.jobs
FOR SELECT 
TO authenticated
USING (
  -- Platform admins can see all jobs
  get_user_type() = 'platform_admin'
  OR (
    -- Users can see jobs from their own organization
    get_user_organization_id() IS NOT NULL 
    AND organization_id = get_user_organization_id()
  )
  OR (
    -- Users can see jobs they are assigned to regardless of organization
    EXISTS (
      SELECT 1 FROM public.job_assignments 
      WHERE job_assignments.job_id = jobs.id 
      AND job_assignments.user_id = auth.uid()
    )
  )
);
