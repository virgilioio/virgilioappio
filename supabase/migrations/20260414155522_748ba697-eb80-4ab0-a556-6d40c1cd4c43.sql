ALTER TABLE public.job_candidate_associations
  ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;