
-- Per-stage scorecard requirements
ALTER TABLE public.job_hiring_stages
  ADD COLUMN IF NOT EXISTS require_scorecard boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scorecard_reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scorecard_reminder_cadence text NOT NULL DEFAULT 'daily'
    CHECK (scorecard_reminder_cadence IN ('daily','every_2_days','weekly'));

-- Tracking table for reminders sent per (association, stage, interviewer)
CREATE TABLE IF NOT EXISTS public.scorecard_reminder_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL,
  job_hiring_stage_id uuid NOT NULL,
  interviewer_user_id uuid NOT NULL,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  sent_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (association_id, job_hiring_stage_id, interviewer_user_id)
);

GRANT ALL ON public.scorecard_reminder_sends TO service_role;
ALTER TABLE public.scorecard_reminder_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.scorecard_reminder_sends FOR ALL USING (false) WITH CHECK (false);
