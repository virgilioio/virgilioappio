ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS reports_to_user_id uuid,
  ADD COLUMN IF NOT EXISTS coordinator_user_id uuid;