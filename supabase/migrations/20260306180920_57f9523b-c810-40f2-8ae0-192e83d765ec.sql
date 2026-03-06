
-- Add new columns to candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS current_job_title TEXT,
  ADD COLUMN IF NOT EXISTS standardized_title TEXT,
  ADD COLUMN IF NOT EXISTS seniority_level TEXT,
  ADD COLUMN IF NOT EXISTS functional_area TEXT,
  ADD COLUMN IF NOT EXISTS specialization TEXT,
  ADD COLUMN IF NOT EXISTS years_in_specialization INTEGER,
  ADD COLUMN IF NOT EXISTS years_in_leadership INTEGER,
  ADD COLUMN IF NOT EXISTS company_count INTEGER,
  ADD COLUMN IF NOT EXISTS avg_tenure_months INTEGER;

-- Add new columns to candidate_work_experience
ALTER TABLE public.candidate_work_experience
  ADD COLUMN IF NOT EXISTS standardized_title TEXT,
  ADD COLUMN IF NOT EXISTS company_industry TEXT,
  ADD COLUMN IF NOT EXISTS company_size_category TEXT,
  ADD COLUMN IF NOT EXISTS duration_months INTEGER;

-- Add education_level to candidate_education
ALTER TABLE public.candidate_education
  ADD COLUMN IF NOT EXISTS education_level TEXT;

-- Create candidate_certifications table
CREATE TABLE IF NOT EXISTS public.candidate_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  certification_name TEXT NOT NULL,
  issuing_organization TEXT,
  year_obtained INTEGER,
  is_bootcamp BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.candidate_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view certifications in their org"
  ON public.candidate_certifications FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_certifications.candidate_id
      AND m.user_id = auth.uid() AND m.user_status = 'active'
  ));

CREATE POLICY "Users can insert certifications in their org"
  ON public.candidate_certifications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_certifications.candidate_id
      AND m.user_id = auth.uid() AND m.user_status = 'active'
  ));

CREATE POLICY "Users can update certifications in their org"
  ON public.candidate_certifications FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_certifications.candidate_id
      AND m.user_id = auth.uid() AND m.user_status = 'active'
  ));

CREATE POLICY "Users can delete certifications in their org"
  ON public.candidate_certifications FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.candidates c
    JOIN public.members m ON m.organization_id = c.organization_id
    WHERE c.id = candidate_certifications.candidate_id
      AND m.user_id = auth.uid() AND m.user_status = 'active'
  ));

CREATE POLICY "Service role full access certifications"
  ON public.candidate_certifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_candidate_certifications_candidate_id ON public.candidate_certifications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidates_standardized_title ON public.candidates(standardized_title);
CREATE INDEX IF NOT EXISTS idx_candidates_seniority_level ON public.candidates(seniority_level);
CREATE INDEX IF NOT EXISTS idx_candidates_functional_area ON public.candidates(functional_area);

CREATE TRIGGER update_candidate_certifications_updated_at
  BEFORE UPDATE ON public.candidate_certifications
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
