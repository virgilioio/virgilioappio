-- Fix platform admin organization isolation
-- Platform admins should respect their current organization context

-- Drop and recreate the jobs RLS policy to enforce organization filtering for all users
DROP POLICY IF EXISTS "jobs_select_with_assignments" ON public.jobs;

CREATE POLICY "jobs_select_with_assignments" ON public.jobs 
FOR SELECT
USING (
  -- All users (including platform admins) must match their organization context
  organization_id = get_user_organization_id() 
  OR
  -- OR be a guest/client assigned to this specific job
  (get_member_role() = 'client' AND EXISTS (
    SELECT 1 FROM public.job_assignments 
    WHERE job_id = jobs.id AND user_id = auth.uid()
  ))
);