-- Drop existing candidate_comments policies
DROP POLICY IF EXISTS "Members and job-assigned users can create comments" ON public.candidate_comments;
DROP POLICY IF EXISTS "Members and job-assigned users can view comments" ON public.candidate_comments;
DROP POLICY IF EXISTS "Platform admins can manage all candidate comments - secure" ON public.candidate_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.candidate_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.candidate_comments;

-- Create new comprehensive policies for candidate_comments

-- INSERT: Allow creation for both job candidates and independent candidates
CREATE POLICY "Users can create comments for manageable candidates"
ON public.candidate_comments
FOR INSERT
WITH CHECK (
  author_id = auth.uid() AND (
    -- Platform admins can create comments on any candidate
    get_user_type_secure() = 'platform_admin' OR
    
    -- For job candidates: organization members or job-assigned users
    (
      job_id IS NOT NULL AND (
        -- Organization members can comment on candidates in their org
        EXISTS (
          SELECT 1 FROM jobs j
          JOIN members m ON j.organization_id = m.organization_id
          WHERE j.id = candidate_comments.job_id
            AND m.user_id = auth.uid()
            AND m.user_status = 'active'
        ) OR
        -- Job-assigned users can comment on their assigned job candidates
        EXISTS (
          SELECT 1 FROM job_assignments ja
          WHERE ja.job_id = candidate_comments.job_id
            AND ja.user_id = auth.uid()
        )
      )
    ) OR
    
    -- For independent candidates: any active organization member can comment
    (
      job_id IS NULL AND 
      EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_comments.candidate_id
      ) AND
      EXISTS (
        SELECT 1 FROM members m
        WHERE m.user_id = auth.uid()
          AND m.user_status = 'active'
          AND m.member_role IN ('admin', 'recruiter')
      )
    )
  )
);

-- SELECT: Allow viewing comments for accessible candidates
CREATE POLICY "Users can view comments for accessible candidates"
ON public.candidate_comments
FOR SELECT
USING (
  -- Platform admins can view all comments
  get_user_type_secure() = 'platform_admin' OR
  
  -- For job candidates: organization members or job-assigned users
  (
    job_id IS NOT NULL AND (
      -- Organization members can view comments in their org
      EXISTS (
        SELECT 1 FROM jobs j
        JOIN members m ON j.organization_id = m.organization_id
        WHERE j.id = candidate_comments.job_id
          AND m.user_id = auth.uid()
          AND m.user_status = 'active'
      ) OR
      -- Job-assigned users can view comments on their assigned jobs
      EXISTS (
        SELECT 1 FROM job_assignments ja
        WHERE ja.job_id = candidate_comments.job_id
          AND ja.user_id = auth.uid()
      )
    )
  ) OR
  
  -- For independent candidates: any active organization member can view
  (
    job_id IS NULL AND 
    EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.id = candidate_comments.candidate_id
    ) AND
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
        AND m.user_status = 'active'
    )
  )
);

-- UPDATE: Allow authors and platform admins to update comments
CREATE POLICY "Users can update their own comments"
ON public.candidate_comments
FOR UPDATE
USING (
  author_id = auth.uid() OR 
  get_user_type_secure() = 'platform_admin'
);

-- DELETE: Allow authors and platform admins to delete comments
CREATE POLICY "Users can delete their own comments"
ON public.candidate_comments
FOR DELETE
USING (
  author_id = auth.uid() OR 
  get_user_type_secure() = 'platform_admin'
);

-- Platform admin policy for all operations
CREATE POLICY "Platform admins can manage all candidate comments"
ON public.candidate_comments
FOR ALL
USING (get_user_type_secure() = 'platform_admin');