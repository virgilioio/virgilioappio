-- ============================================================================
-- Migration: Patch RLS Policies for Candidate Relations Tables
-- Created: 2025-01-XX
-- Purpose: Add organization-scoped RLS policies to candidate_education, 
--          candidate_urls, and candidate_work_experience tables
-- ============================================================================

-- Ensure RLS is enabled on all three tables
ALTER TABLE public.candidate_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_work_experience ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CANDIDATE EDUCATION POLICIES
-- ============================================================================

COMMENT ON TABLE public.candidate_education IS 
'Education history for candidates. Access controlled by candidate organization membership.';

-- SELECT Policy
CREATE POLICY "Org members can view candidate education"
ON public.candidate_education
FOR SELECT
USING (
  -- Platform admins have full access
  public.get_user_type_secure() = 'platform_admin'
  OR
  -- Org members can view education for candidates in their organization
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_education.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

COMMENT ON POLICY "Org members can view candidate education" ON public.candidate_education IS
'Allows organization members to view education records for candidates within their organization. Platform admins bypass this check.';

-- INSERT Policy
CREATE POLICY "Org members can insert candidate education"
ON public.candidate_education
FOR INSERT
WITH CHECK (
  -- Platform admins have full access
  public.get_user_type_secure() = 'platform_admin'
  OR
  -- Org members can insert education for candidates in their organization
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_education.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

COMMENT ON POLICY "Org members can insert candidate education" ON public.candidate_education IS
'Allows organization members to add education records for candidates within their organization.';

-- UPDATE Policy
CREATE POLICY "Org members can update candidate education"
ON public.candidate_education
FOR UPDATE
USING (
  public.get_user_type_secure() = 'platform_admin'
  OR
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_education.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
)
WITH CHECK (
  public.get_user_type_secure() = 'platform_admin'
  OR
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_education.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

COMMENT ON POLICY "Org members can update candidate education" ON public.candidate_education IS
'Allows organization members to update education records for candidates within their organization.';

-- DELETE Policy
CREATE POLICY "Org members can delete candidate education"
ON public.candidate_education
FOR DELETE
USING (
  public.get_user_type_secure() = 'platform_admin'
  OR
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_education.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

COMMENT ON POLICY "Org members can delete candidate education" ON public.candidate_education IS
'Allows organization members to delete education records for candidates within their organization.';

-- ============================================================================
-- CANDIDATE URLS POLICIES
-- ============================================================================

COMMENT ON TABLE public.candidate_urls IS 
'Social and professional URLs for candidates. Access controlled by candidate organization membership.';

-- SELECT Policy
CREATE POLICY "Org members can view candidate urls"
ON public.candidate_urls
FOR SELECT
USING (
  public.get_user_type_secure() = 'platform_admin'
  OR
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_urls.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

COMMENT ON POLICY "Org members can view candidate urls" ON public.candidate_urls IS
'Allows organization members to view URL records for candidates within their organization. Platform admins bypass this check.';

-- INSERT Policy
CREATE POLICY "Org members can insert candidate urls"
ON public.candidate_urls
FOR INSERT
WITH CHECK (
  public.get_user_type_secure() = 'platform_admin'
  OR
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_urls.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

COMMENT ON POLICY "Org members can insert candidate urls" ON public.candidate_urls IS
'Allows organization members to add URL records for candidates within their organization.';

-- UPDATE Policy
CREATE POLICY "Org members can update candidate urls"
ON public.candidate_urls
FOR UPDATE
USING (
  public.get_user_type_secure() = 'platform_admin'
  OR
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_urls.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
)
WITH CHECK (
  public.get_user_type_secure() = 'platform_admin'
  OR
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_urls.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

COMMENT ON POLICY "Org members can update candidate urls" ON public.candidate_urls IS
'Allows organization members to update URL records for candidates within their organization.';

-- DELETE Policy
CREATE POLICY "Org members can delete candidate urls"
ON public.candidate_urls
FOR DELETE
USING (
  public.get_user_type_secure() = 'platform_admin'
  OR
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_urls.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

COMMENT ON POLICY "Org members can delete candidate urls" ON public.candidate_urls IS
'Allows organization members to delete URL records for candidates within their organization.';

-- ============================================================================
-- CANDIDATE WORK EXPERIENCE POLICIES
-- ============================================================================

COMMENT ON TABLE public.candidate_work_experience IS 
'Work history for candidates. Access controlled by candidate organization membership.';

-- SELECT Policy
CREATE POLICY "Org members can view candidate work experience"
ON public.candidate_work_experience
FOR SELECT
USING (
  public.get_user_type_secure() = 'platform_admin'
  OR
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_work_experience.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

COMMENT ON POLICY "Org members can view candidate work experience" ON public.candidate_work_experience IS
'Allows organization members to view work experience records for candidates within their organization. Platform admins bypass this check.';

-- INSERT Policy
CREATE POLICY "Org members can insert candidate work experience"
ON public.candidate_work_experience
FOR INSERT
WITH CHECK (
  public.get_user_type_secure() = 'platform_admin'
  OR
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_work_experience.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

COMMENT ON POLICY "Org members can insert candidate work experience" ON public.candidate_work_experience IS
'Allows organization members to add work experience records for candidates within their organization.';

-- UPDATE Policy
CREATE POLICY "Org members can update candidate work experience"
ON public.candidate_work_experience
FOR UPDATE
USING (
  public.get_user_type_secure() = 'platform_admin'
  OR
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_work_experience.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
)
WITH CHECK (
  public.get_user_type_secure() = 'platform_admin'
  OR
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_work_experience.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

COMMENT ON POLICY "Org members can update candidate work experience" ON public.candidate_work_experience IS
'Allows organization members to update work experience records for candidates within their organization.';

-- DELETE Policy
CREATE POLICY "Org members can delete candidate work experience"
ON public.candidate_work_experience
FOR DELETE
USING (
  public.get_user_type_secure() = 'platform_admin'
  OR
  EXISTS (
    SELECT 1 
    FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_work_experience.candidate_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

COMMENT ON POLICY "Org members can delete candidate work experience" ON public.candidate_work_experience IS
'Allows organization members to delete work experience records for candidates within their organization.';

-- ============================================================================
-- VERIFICATION QUERIES (DO NOT EXECUTE - FOR AUDIT PURPOSES ONLY)
-- ============================================================================

/*
-- Verify RLS is enabled
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename IN ('candidate_education', 'candidate_urls', 'candidate_work_experience');

-- Expected: rowsecurity = true for all three tables

-- Verify policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('candidate_education', 'candidate_urls', 'candidate_work_experience')
ORDER BY tablename, cmd;

-- Expected: 4 policies per table (SELECT, INSERT, UPDATE, DELETE) = 12 total policies

-- Test organization isolation (as org member, should NOT see other org's candidate data)
-- SELECT * FROM candidate_education WHERE candidate_id = '<candidate_from_different_org>';
-- Expected: 0 rows (blocked by RLS)

-- Test platform admin access (should see all data)
-- SET LOCAL ROLE authenticated;
-- SET LOCAL jwt.claims.user_metadata TO '{"user_type": "platform_admin"}';
-- SELECT COUNT(*) FROM candidate_education;
-- Expected: All rows visible

-- Test org member access (should see only own org's candidate data)
-- SELECT ce.* 
-- FROM candidate_education ce
-- JOIN candidates c ON c.id = ce.candidate_id
-- WHERE c.organization_id = '<user_org_id>';
-- Expected: Only rows from user's organization
*/