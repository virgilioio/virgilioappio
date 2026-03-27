ALTER TABLE public.job_candidate_associations
  ADD COLUMN IF NOT EXISTS hired_at timestamptz,
  ADD COLUMN IF NOT EXISTS hired_by uuid REFERENCES auth.users(id);