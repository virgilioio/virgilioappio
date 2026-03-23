ALTER TABLE public.scheduled_bookings
  DROP CONSTRAINT IF EXISTS scheduled_bookings_draft_scorecard_id_fkey;

ALTER TABLE public.scheduled_bookings
  ADD CONSTRAINT scheduled_bookings_draft_scorecard_id_fkey
  FOREIGN KEY (draft_scorecard_id)
  REFERENCES public.job_stage_scorecards(id)
  ON DELETE SET NULL;