-- Fix FK to match our association model: associations.candidate_id references public.candidates(id)
BEGIN;

ALTER TABLE public.job_stage_scorecards
  DROP CONSTRAINT IF EXISTS job_stage_scorecards_candidate_id_fkey;

ALTER TABLE public.job_stage_scorecards
  ADD CONSTRAINT job_stage_scorecards_candidate_id_fkey
  FOREIGN KEY (candidate_id)
  REFERENCES public.candidates(id)
  ON DELETE CASCADE;

COMMIT;