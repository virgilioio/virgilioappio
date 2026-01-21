-- =====================================================
-- Fix stage_scorecard_templates RLS policies
-- Replace check_org_member_access with check_org_hierarchy_role_access
-- which properly handles tenant → child org hierarchy + role inheritance
-- =====================================================

DROP POLICY IF EXISTS "Users can view templates for jobs they can access" ON public.stage_scorecard_templates;
DROP POLICY IF EXISTS "Users can create templates for jobs they can manage" ON public.stage_scorecard_templates;
DROP POLICY IF EXISTS "Users can update templates for jobs they can manage" ON public.stage_scorecard_templates;
DROP POLICY IF EXISTS "Users can delete templates for jobs they can manage" ON public.stage_scorecard_templates;

-- SELECT: Recruiter+ (admin, recruiter) can view
CREATE POLICY "Users can view templates for jobs they can access"
ON public.stage_scorecard_templates FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    JOIN jobs j ON j.id = jhs.job_id
    WHERE jhs.id = stage_scorecard_templates.job_hiring_stage_id
    AND check_org_hierarchy_role_access(j.organization_id, 'recruiter')
  )
);

-- INSERT: Admin or Recruiter can create
CREATE POLICY "Users can create templates for jobs they can manage"
ON public.stage_scorecard_templates FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    JOIN jobs j ON j.id = jhs.job_id
    WHERE jhs.id = stage_scorecard_templates.job_hiring_stage_id
    AND check_org_hierarchy_role_access(j.organization_id, 'recruiter')
  )
);

-- UPDATE: Admin or Recruiter can update
CREATE POLICY "Users can update templates for jobs they can manage"
ON public.stage_scorecard_templates FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    JOIN jobs j ON j.id = jhs.job_id
    WHERE jhs.id = stage_scorecard_templates.job_hiring_stage_id
    AND check_org_hierarchy_role_access(j.organization_id, 'recruiter')
  )
);

-- DELETE: Admin or Recruiter can delete
CREATE POLICY "Users can delete templates for jobs they can manage"
ON public.stage_scorecard_templates FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    JOIN jobs j ON j.id = jhs.job_id
    WHERE jhs.id = stage_scorecard_templates.job_hiring_stage_id
    AND check_org_hierarchy_role_access(j.organization_id, 'recruiter')
  )
);

-- =====================================================
-- Fix scorecard_interview_questions RLS policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view questions for templates they can access" ON public.scorecard_interview_questions;
DROP POLICY IF EXISTS "Users can create questions for templates they can manage" ON public.scorecard_interview_questions;
DROP POLICY IF EXISTS "Users can update questions for templates they can manage" ON public.scorecard_interview_questions;
DROP POLICY IF EXISTS "Users can delete questions for templates they can manage" ON public.scorecard_interview_questions;

-- SELECT: Recruiter+ can view
CREATE POLICY "Users can view questions for templates they can access"
ON public.scorecard_interview_questions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stage_scorecard_templates sst
    JOIN job_hiring_stages jhs ON jhs.id = sst.job_hiring_stage_id
    JOIN jobs j ON j.id = jhs.job_id
    WHERE sst.id = scorecard_interview_questions.scorecard_template_id
    AND check_org_hierarchy_role_access(j.organization_id, 'recruiter')
  )
);

-- INSERT: Admin or Recruiter can create
CREATE POLICY "Users can create questions for templates they can manage"
ON public.scorecard_interview_questions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stage_scorecard_templates sst
    JOIN job_hiring_stages jhs ON jhs.id = sst.job_hiring_stage_id
    JOIN jobs j ON j.id = jhs.job_id
    WHERE sst.id = scorecard_interview_questions.scorecard_template_id
    AND check_org_hierarchy_role_access(j.organization_id, 'recruiter')
  )
);

-- UPDATE: Admin or Recruiter can update
CREATE POLICY "Users can update questions for templates they can manage"
ON public.scorecard_interview_questions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stage_scorecard_templates sst
    JOIN job_hiring_stages jhs ON jhs.id = sst.job_hiring_stage_id
    JOIN jobs j ON j.id = jhs.job_id
    WHERE sst.id = scorecard_interview_questions.scorecard_template_id
    AND check_org_hierarchy_role_access(j.organization_id, 'recruiter')
  )
);

-- DELETE: Admin or Recruiter can delete
CREATE POLICY "Users can delete questions for templates they can manage"
ON public.scorecard_interview_questions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stage_scorecard_templates sst
    JOIN job_hiring_stages jhs ON jhs.id = sst.job_hiring_stage_id
    JOIN jobs j ON j.id = jhs.job_id
    WHERE sst.id = scorecard_interview_questions.scorecard_template_id
    AND check_org_hierarchy_role_access(j.organization_id, 'recruiter')
  )
);