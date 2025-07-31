-- Drop existing policies for candidate_comments SELECT and INSERT
DROP POLICY IF EXISTS "Organization members can view comments in their org" ON public.candidate_comments;
DROP POLICY IF EXISTS "Organization members can create comments in their org" ON public.candidate_comments;

-- Create updated SELECT policy that allows both organization members AND job-assigned users
CREATE POLICY "Members and job-assigned users can view comments" 
ON public.candidate_comments 
FOR SELECT 
USING (
  -- Allow organization members to view comments in their org
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid() 
      AND m.organization_id = candidate_comments.organization_id 
      AND m.user_status = 'active'
  )
  OR
  -- Allow users assigned to the job to view comments for candidates in that job
  EXISTS (
    SELECT 1 FROM job_assignments ja
    JOIN job_candidates jc ON ja.job_id = jc.job_id
    WHERE ja.user_id = auth.uid() 
      AND jc.id = candidate_comments.candidate_id
  )
  OR
  -- Allow users assigned to independent candidate jobs via job_candidate_associations
  EXISTS (
    SELECT 1 FROM job_assignments ja
    JOIN job_candidate_associations jca ON ja.job_id = jca.job_id
    WHERE ja.user_id = auth.uid() 
      AND jca.candidate_id = candidate_comments.candidate_id
  )
);

-- Create updated INSERT policy that allows both organization members AND job-assigned users
CREATE POLICY "Members and job-assigned users can create comments" 
ON public.candidate_comments 
FOR INSERT 
WITH CHECK (
  -- Ensure author_id matches current user
  author_id = auth.uid()
  AND
  (
    -- Allow organization members to create comments in their org
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid() 
        AND m.organization_id = candidate_comments.organization_id 
        AND m.user_status = 'active'
    )
    OR
    -- Allow users assigned to the job to create comments for candidates in that job
    EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN job_candidates jc ON ja.job_id = jc.job_id
      WHERE ja.user_id = auth.uid() 
        AND jc.id = candidate_comments.candidate_id
    )
    OR
    -- Allow users assigned to independent candidate jobs via job_candidate_associations
    EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN job_candidate_associations jca ON ja.job_id = jca.job_id
      WHERE ja.user_id = auth.uid() 
        AND jca.candidate_id = candidate_comments.candidate_id
    )
  )
);