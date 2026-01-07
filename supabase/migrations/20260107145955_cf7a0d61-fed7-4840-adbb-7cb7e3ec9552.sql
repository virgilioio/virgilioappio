-- Fix missing SELECT and INSERT RLS policies for candidate_comments
-- The UPDATE and DELETE policies already exist and work correctly

-- DROP existing policies if they somehow exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view comments for accessible candidates" ON public.candidate_comments;
DROP POLICY IF EXISTS "Users can create comments for accessible candidates" ON public.candidate_comments;

-- SELECT Policy: Allow viewing comments for accessible candidates
CREATE POLICY "Users can view comments for accessible candidates"
ON public.candidate_comments
FOR SELECT
USING (
  -- Platform admins can view all comments
  get_user_type_secure() = 'platform_admin'
  OR
  (
    -- 1. Organization hierarchy access to the job
    (
      job_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM jobs j
        WHERE j.id = candidate_comments.job_id
          AND check_org_member_access(j.organization_id)
      )
    )
    OR
    -- 2. Direct job assignment
    (
      job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM job_assignments ja
        WHERE ja.job_id = candidate_comments.job_id
          AND ja.user_id = auth.uid()
      )
    )
    OR
    -- 3. Independent candidates (no job_id) - any active org member
    (
      job_id IS NULL
      AND organization_id IS NOT NULL
      AND check_org_member_access(organization_id)
    )
  )
);

-- INSERT Policy: Allow creating comments for accessible candidates
CREATE POLICY "Users can create comments for accessible candidates"
ON public.candidate_comments
FOR INSERT
WITH CHECK (
  -- Must set themselves as author
  author_id = auth.uid()
  AND
  (
    -- Platform admins can create comments on any candidate
    get_user_type_secure() = 'platform_admin'
    OR
    (
      -- 1. Organization hierarchy access (recruiter role or higher)
      (
        job_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM jobs j
          WHERE j.id = candidate_comments.job_id
            AND check_org_member_access(j.organization_id, 'recruiter'::member_role)
        )
      )
      OR
      -- 2. Direct job assignment (any assigned user can comment)
      (
        job_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM job_assignments ja
          WHERE ja.job_id = candidate_comments.job_id
            AND ja.user_id = auth.uid()
        )
      )
      OR
      -- 3. Independent candidates - recruiter/admin in org
      (
        job_id IS NULL
        AND organization_id IS NOT NULL
        AND check_org_member_access(organization_id, 'recruiter'::member_role)
      )
    )
  )
);