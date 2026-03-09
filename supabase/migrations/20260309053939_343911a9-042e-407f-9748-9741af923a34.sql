
-- Drop existing policy
DROP POLICY IF EXISTS "Organization members can view application responses" ON public.candidate_application_responses;

-- Create updated policy with tenant-based platform_admin access
CREATE POLICY "Organization members can view application responses"
ON public.candidate_application_responses
FOR SELECT
TO authenticated
USING (
  -- Path 1: org membership match via jobs
  EXISTS (
    SELECT 1
    FROM jobs j
    JOIN members m ON j.organization_id = m.organization_id
    WHERE j.id = candidate_application_responses.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
  OR
  -- Path 2: platform_admin via user_type check (no SET LOCAL needed)
  EXISTS (
    SELECT 1
    FROM members m
    WHERE m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND m.user_type = 'platform_admin'
  )
  OR
  -- Path 3: tenant-based access (same tenant as the job)
  EXISTS (
    SELECT 1
    FROM jobs j
    JOIN members m ON j.tenant_id = m.tenant_id
    WHERE j.id = candidate_application_responses.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);
