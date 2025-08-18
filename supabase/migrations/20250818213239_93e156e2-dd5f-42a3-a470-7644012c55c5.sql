-- Fix candidate_attachments RLS policies to support both job_candidates and independent candidates

-- Drop existing policies that only check job_candidates
DROP POLICY IF EXISTS "Users can upload attachments for candidates they can manage" ON public.candidate_attachments;
DROP POLICY IF EXISTS "Users can view attachments for candidates they can access" ON public.candidate_attachments;
DROP POLICY IF EXISTS "Users can update attachments for candidates they can manage" ON public.candidate_attachments;

-- Create new comprehensive policies that check both job_candidates and independent candidates

-- INSERT policy: Allow upload for both job candidates and independent candidates
CREATE POLICY "Users can upload attachments for any manageable candidates"
ON public.candidate_attachments
FOR INSERT
WITH CHECK (
  -- Platform admins can upload for anyone
  get_user_type_secure() = 'platform_admin'
  OR
  -- For job candidates: org recruiters/admins or assigned users
  (
    EXISTS (
      SELECT 1
      FROM job_candidates jc
      JOIN jobs j ON jc.job_id = j.id
      JOIN members m ON j.organization_id = m.organization_id
      WHERE jc.id = candidate_attachments.candidate_id
        AND m.user_id = auth.uid()
        AND m.member_role IN ('admin', 'recruiter')
        AND m.user_status = 'active'
    )
    OR
    EXISTS (
      SELECT 1
      FROM job_candidates jc
      JOIN job_assignments ja ON jc.job_id = ja.job_id
      WHERE jc.id = candidate_attachments.candidate_id
        AND ja.user_id = auth.uid()
    )
  )
  OR
  -- For independent candidates: active recruiters/admins in any org
  (
    EXISTS (
      SELECT 1
      FROM candidates c
      WHERE c.id = candidate_attachments.candidate_id
    )
    AND
    EXISTS (
      SELECT 1
      FROM members m
      WHERE m.user_id = auth.uid()
        AND m.member_role IN ('admin', 'recruiter')
        AND m.user_status = 'active'
    )
  )
);

-- SELECT policy: Allow viewing for both job candidates and independent candidates  
CREATE POLICY "Users can view attachments for accessible candidates"
ON public.candidate_attachments
FOR SELECT
USING (
  -- Platform admins can view all
  get_user_type_secure() = 'platform_admin'
  OR
  -- For job candidates: org members or assigned users
  (
    EXISTS (
      SELECT 1
      FROM job_candidates jc
      JOIN jobs j ON jc.job_id = j.id
      JOIN members m ON j.organization_id = m.organization_id
      WHERE jc.id = candidate_attachments.candidate_id
        AND m.user_id = auth.uid()
        AND m.user_status = 'active'
    )
    OR
    EXISTS (
      SELECT 1
      FROM job_candidates jc
      JOIN job_assignments ja ON jc.job_id = ja.job_id
      WHERE jc.id = candidate_attachments.candidate_id
        AND ja.user_id = auth.uid()
    )
  )
  OR
  -- For independent candidates: active members in any org
  (
    EXISTS (
      SELECT 1
      FROM candidates c
      WHERE c.id = candidate_attachments.candidate_id
    )
    AND
    EXISTS (
      SELECT 1
      FROM members m
      WHERE m.user_id = auth.uid()
        AND m.user_status = 'active'
    )
  )
);

-- UPDATE policy: Allow updating for both job candidates and independent candidates
CREATE POLICY "Users can update attachments for manageable candidates"
ON public.candidate_attachments
FOR UPDATE
USING (
  -- Platform admins can update all
  get_user_type_secure() = 'platform_admin'
  OR
  -- For job candidates: org recruiters/admins or assigned users
  (
    EXISTS (
      SELECT 1
      FROM job_candidates jc
      JOIN jobs j ON jc.job_id = j.id
      JOIN members m ON j.organization_id = m.organization_id
      WHERE jc.id = candidate_attachments.candidate_id
        AND m.user_id = auth.uid()
        AND m.member_role IN ('admin', 'recruiter')
        AND m.user_status = 'active'
    )
    OR
    EXISTS (
      SELECT 1
      FROM job_candidates jc
      JOIN job_assignments ja ON jc.job_id = ja.job_id
      WHERE jc.id = candidate_attachments.candidate_id
        AND ja.user_id = auth.uid()
    )
  )
  OR
  -- For independent candidates: active recruiters/admins in any org
  (
    EXISTS (
      SELECT 1
      FROM candidates c
      WHERE c.id = candidate_attachments.candidate_id
    )
    AND
    EXISTS (
      SELECT 1
      FROM members m
      WHERE m.user_id = auth.uid()
        AND m.member_role IN ('admin', 'recruiter')
        AND m.user_status = 'active'
    )
  )
)
WITH CHECK (
  -- Same logic for WITH CHECK as USING
  get_user_type_secure() = 'platform_admin'
  OR
  (
    EXISTS (
      SELECT 1
      FROM job_candidates jc
      JOIN jobs j ON jc.job_id = j.id
      JOIN members m ON j.organization_id = m.organization_id
      WHERE jc.id = candidate_attachments.candidate_id
        AND m.user_id = auth.uid()
        AND m.member_role IN ('admin', 'recruiter')
        AND m.user_status = 'active'
    )
    OR
    EXISTS (
      SELECT 1
      FROM job_candidates jc
      JOIN job_assignments ja ON jc.job_id = ja.job_id
      WHERE jc.id = candidate_attachments.candidate_id
        AND ja.user_id = auth.uid()
    )
  )
  OR
  (
    EXISTS (
      SELECT 1
      FROM candidates c
      WHERE c.id = candidate_attachments.candidate_id
    )
    AND
    EXISTS (
      SELECT 1
      FROM members m
      WHERE m.user_id = auth.uid()
        AND m.member_role IN ('admin', 'recruiter')
        AND m.user_status = 'active'
    )
  )
);