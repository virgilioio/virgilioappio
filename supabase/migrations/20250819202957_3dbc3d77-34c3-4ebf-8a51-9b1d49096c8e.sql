-- Fix candidate comments RLS policy for better access control
DROP POLICY IF EXISTS "Users can view comments for accessible candidates" ON public.candidate_comments;

-- Create a simpler and more reliable RLS policy for candidate comments SELECT
CREATE POLICY "Users can view comments for accessible candidates - fixed" 
ON public.candidate_comments 
FOR SELECT 
USING (
  -- Platform admins can see all comments
  get_user_type_secure() = 'platform_admin'
  OR 
  -- Users can see comments if they have access to the candidate through:
  (
    -- 1. They're in the same organization as the job (if job_id exists)
    (job_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM jobs j 
      JOIN members m ON j.organization_id = m.organization_id 
      WHERE j.id = candidate_comments.job_id 
        AND m.user_id = auth.uid() 
        AND m.user_status = 'active'
    ))
    OR
    -- 2. They're assigned to the job (if job_id exists)
    (job_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM job_assignments ja 
      WHERE ja.job_id = candidate_comments.job_id 
        AND ja.user_id = auth.uid()
    ))
    OR
    -- 3. For independent candidates (job_id is NULL), they're an active org member
    (job_id IS NULL AND EXISTS (
      SELECT 1 FROM members m 
      WHERE m.user_id = auth.uid() 
        AND m.user_status = 'active' 
        AND m.member_role IN ('admin', 'recruiter')
    ))
  )
);