ALTER TABLE public.job_candidate_associations
ADD COLUMN IF NOT EXISTS rejection_notes TEXT;