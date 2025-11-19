-- Create enum for interview answer types
CREATE TYPE interview_answer_type AS ENUM ('text', 'yes_no', 'single_select', 'multi_select');

-- Create stage_scorecard_templates table
CREATE TABLE public.stage_scorecard_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_hiring_stage_id UUID NOT NULL REFERENCES public.job_hiring_stages(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scorecard_interview_questions table
CREATE TABLE public.scorecard_interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_template_id UUID NOT NULL REFERENCES public.stage_scorecard_templates(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  answer_type interview_answer_type NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL,
  select_options JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scorecard_question_responses table
CREATE TABLE public.scorecard_question_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id UUID NOT NULL REFERENCES public.job_stage_scorecards(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.scorecard_interview_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_options JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stage_scorecard_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecard_interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecard_question_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stage_scorecard_templates
CREATE POLICY "Users can view templates for jobs they can access"
ON public.stage_scorecard_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_hiring_stages jhs
    JOIN public.jobs j ON j.id = jhs.job_id
    WHERE jhs.id = job_hiring_stage_id
    AND public.user_has_org_hierarchy_access(j.organization_id)
  )
);

CREATE POLICY "Users can create templates for jobs they can manage"
ON public.stage_scorecard_templates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.job_hiring_stages jhs
    JOIN public.jobs j ON j.id = jhs.job_id
    WHERE jhs.id = job_hiring_stage_id
    AND public.user_has_org_hierarchy_access(j.organization_id)
    AND public.check_org_member_access(j.organization_id, 'recruiter'::public.member_role)
  )
);

CREATE POLICY "Users can update templates for jobs they can manage"
ON public.stage_scorecard_templates FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.job_hiring_stages jhs
    JOIN public.jobs j ON j.id = jhs.job_id
    WHERE jhs.id = job_hiring_stage_id
    AND public.user_has_org_hierarchy_access(j.organization_id)
    AND public.check_org_member_access(j.organization_id, 'recruiter'::public.member_role)
  )
);

CREATE POLICY "Users can delete templates for jobs they can manage"
ON public.stage_scorecard_templates FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.job_hiring_stages jhs
    JOIN public.jobs j ON j.id = jhs.job_id
    WHERE jhs.id = job_hiring_stage_id
    AND public.user_has_org_hierarchy_access(j.organization_id)
    AND public.check_org_member_access(j.organization_id, 'recruiter'::public.member_role)
  )
);

-- RLS Policies for scorecard_interview_questions
CREATE POLICY "Users can view questions for templates they can access"
ON public.scorecard_interview_questions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stage_scorecard_templates sst
    JOIN public.job_hiring_stages jhs ON jhs.id = sst.job_hiring_stage_id
    JOIN public.jobs j ON j.id = jhs.job_id
    WHERE sst.id = scorecard_template_id
    AND public.user_has_org_hierarchy_access(j.organization_id)
  )
);

CREATE POLICY "Users can create questions for templates they can manage"
ON public.scorecard_interview_questions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stage_scorecard_templates sst
    JOIN public.job_hiring_stages jhs ON jhs.id = sst.job_hiring_stage_id
    JOIN public.jobs j ON j.id = jhs.job_id
    WHERE sst.id = scorecard_template_id
    AND public.user_has_org_hierarchy_access(j.organization_id)
    AND public.check_org_member_access(j.organization_id, 'recruiter'::public.member_role)
  )
);

CREATE POLICY "Users can update questions for templates they can manage"
ON public.scorecard_interview_questions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.stage_scorecard_templates sst
    JOIN public.job_hiring_stages jhs ON jhs.id = sst.job_hiring_stage_id
    JOIN public.jobs j ON j.id = jhs.job_id
    WHERE sst.id = scorecard_template_id
    AND public.user_has_org_hierarchy_access(j.organization_id)
    AND public.check_org_member_access(j.organization_id, 'recruiter'::public.member_role)
  )
);

CREATE POLICY "Users can delete questions for templates they can manage"
ON public.scorecard_interview_questions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.stage_scorecard_templates sst
    JOIN public.job_hiring_stages jhs ON jhs.id = sst.job_hiring_stage_id
    JOIN public.jobs j ON j.id = jhs.job_id
    WHERE sst.id = scorecard_template_id
    AND public.user_has_org_hierarchy_access(j.organization_id)
    AND public.check_org_member_access(j.organization_id, 'recruiter'::public.member_role)
  )
);

-- RLS Policies for scorecard_question_responses
CREATE POLICY "Users can view responses for scorecards they can access"
ON public.scorecard_question_responses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_stage_scorecards jss
    JOIN public.job_candidate_associations jca ON jca.id = jss.association_id
    JOIN public.jobs j ON j.id = jca.job_id
    WHERE jss.id = scorecard_id
    AND public.user_has_org_hierarchy_access(j.organization_id)
  )
);

CREATE POLICY "Users can create responses for scorecards they can submit"
ON public.scorecard_question_responses FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.job_stage_scorecards jss
    JOIN public.job_candidate_associations jca ON jca.id = jss.association_id
    JOIN public.jobs j ON j.id = jca.job_id
    WHERE jss.id = scorecard_id
    AND public.user_has_org_hierarchy_access(j.organization_id)
  )
);

CREATE POLICY "Users can update their own responses"
ON public.scorecard_question_responses FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.job_stage_scorecards jss
    WHERE jss.id = scorecard_id
    AND jss.created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete their own responses"
ON public.scorecard_question_responses FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.job_stage_scorecards jss
    WHERE jss.id = scorecard_id
    AND jss.created_by = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_stage_scorecard_templates_jhs ON public.stage_scorecard_templates(job_hiring_stage_id);
CREATE INDEX idx_scorecard_interview_questions_template ON public.scorecard_interview_questions(scorecard_template_id);
CREATE INDEX idx_scorecard_interview_questions_order ON public.scorecard_interview_questions(scorecard_template_id, display_order);
CREATE INDEX idx_scorecard_question_responses_scorecard ON public.scorecard_question_responses(scorecard_id);
CREATE INDEX idx_scorecard_question_responses_question ON public.scorecard_question_responses(question_id);

-- Create trigger for updated_at
CREATE TRIGGER set_stage_scorecard_templates_updated_at
  BEFORE UPDATE ON public.stage_scorecard_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_scorecard_interview_questions_updated_at
  BEFORE UPDATE ON public.scorecard_interview_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_scorecard_question_responses_updated_at
  BEFORE UPDATE ON public.scorecard_question_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();