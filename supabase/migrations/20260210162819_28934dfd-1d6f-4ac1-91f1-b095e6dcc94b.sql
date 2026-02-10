
-- Add AI fit analysis columns to job_candidate_associations
ALTER TABLE public.job_candidate_associations
  ADD COLUMN IF NOT EXISTS ai_fit_score integer,
  ADD COLUMN IF NOT EXISTS ai_fit_analysis jsonb,
  ADD COLUMN IF NOT EXISTS ai_fit_confidence text,
  ADD COLUMN IF NOT EXISTS ai_fit_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_fit_version integer DEFAULT 0;

-- Add check constraint for score range
ALTER TABLE public.job_candidate_associations
  ADD CONSTRAINT ai_fit_score_range CHECK (ai_fit_score IS NULL OR (ai_fit_score >= 0 AND ai_fit_score <= 100));

-- Add check constraint for confidence values
ALTER TABLE public.job_candidate_associations
  ADD CONSTRAINT ai_fit_confidence_values CHECK (ai_fit_confidence IS NULL OR ai_fit_confidence IN ('low', 'medium', 'high'));
