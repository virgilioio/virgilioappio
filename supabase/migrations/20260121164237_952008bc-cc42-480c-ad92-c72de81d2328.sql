-- Fix stage_scorecard_templates policies to allow admin OR recruiter roles
DROP POLICY IF EXISTS "Users can create templates for jobs they can manage" ON public.stage_scorecard_templates;
DROP POLICY IF EXISTS "Users can update templates for jobs they can manage" ON public.stage_scorecard_templates;
DROP POLICY IF EXISTS "Users can delete templates for jobs they can manage" ON public.stage_scorecard_templates;

-- Allow admin OR recruiter to create templates
CREATE POLICY "Users can create templates for jobs they can manage"
ON public.stage_scorecard_templates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    JOIN jobs j ON j.id = jhs.job_id
    WHERE jhs.id = stage_scorecard_templates.job_hiring_stage_id
    AND user_has_org_hierarchy_access(j.organization_id)
    AND (
      check_org_member_access(j.organization_id, 'recruiter'::member_role)
      OR check_org_member_access(j.organization_id, 'admin'::member_role)
    )
  )
);

-- Allow admin OR recruiter to update templates
CREATE POLICY "Users can update templates for jobs they can manage"
ON public.stage_scorecard_templates FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    JOIN jobs j ON j.id = jhs.job_id
    WHERE jhs.id = stage_scorecard_templates.job_hiring_stage_id
    AND user_has_org_hierarchy_access(j.organization_id)
    AND (
      check_org_member_access(j.organization_id, 'recruiter'::member_role)
      OR check_org_member_access(j.organization_id, 'admin'::member_role)
    )
  )
);

-- Allow admin OR recruiter to delete templates
CREATE POLICY "Users can delete templates for jobs they can manage"
ON public.stage_scorecard_templates FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM job_hiring_stages jhs
    JOIN jobs j ON j.id = jhs.job_id
    WHERE jhs.id = stage_scorecard_templates.job_hiring_stage_id
    AND user_has_org_hierarchy_access(j.organization_id)
    AND (
      check_org_member_access(j.organization_id, 'recruiter'::member_role)
      OR check_org_member_access(j.organization_id, 'admin'::member_role)
    )
  )
);

-- Fix scorecard_interview_questions policies to allow admin OR recruiter roles
DROP POLICY IF EXISTS "Users can create questions for templates they can manage" ON public.scorecard_interview_questions;
DROP POLICY IF EXISTS "Users can update questions for templates they can manage" ON public.scorecard_interview_questions;
DROP POLICY IF EXISTS "Users can delete questions for templates they can manage" ON public.scorecard_interview_questions;

-- Allow admin OR recruiter to create questions
CREATE POLICY "Users can create questions for templates they can manage"
ON public.scorecard_interview_questions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stage_scorecard_templates sst
    JOIN job_hiring_stages jhs ON jhs.id = sst.job_hiring_stage_id
    JOIN jobs j ON j.id = jhs.job_id
    WHERE sst.id = scorecard_interview_questions.scorecard_template_id
    AND user_has_org_hierarchy_access(j.organization_id)
    AND (
      check_org_member_access(j.organization_id, 'recruiter'::member_role)
      OR check_org_member_access(j.organization_id, 'admin'::member_role)
    )
  )
);

-- Allow admin OR recruiter to update questions
CREATE POLICY "Users can update questions for templates they can manage"
ON public.scorecard_interview_questions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM stage_scorecard_templates sst
    JOIN job_hiring_stages jhs ON jhs.id = sst.job_hiring_stage_id
    JOIN jobs j ON j.id = jhs.job_id
    WHERE sst.id = scorecard_interview_questions.scorecard_template_id
    AND user_has_org_hierarchy_access(j.organization_id)
    AND (
      check_org_member_access(j.organization_id, 'recruiter'::member_role)
      OR check_org_member_access(j.organization_id, 'admin'::member_role)
    )
  )
);

-- Allow admin OR recruiter to delete questions
CREATE POLICY "Users can delete questions for templates they can manage"
ON public.scorecard_interview_questions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM stage_scorecard_templates sst
    JOIN job_hiring_stages jhs ON jhs.id = sst.job_hiring_stage_id
    JOIN jobs j ON j.id = jhs.job_id
    WHERE sst.id = scorecard_interview_questions.scorecard_template_id
    AND user_has_org_hierarchy_access(j.organization_id)
    AND (
      check_org_member_access(j.organization_id, 'recruiter'::member_role)
      OR check_org_member_access(j.organization_id, 'admin'::member_role)
    )
  )
);