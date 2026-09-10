-- ───────────────────────── Enums ─────────────────────────
DO $$ BEGIN
  CREATE TYPE public.automation_action AS ENUM (
    'email','sequence','chat','scheduling','documents',
    'notify','task','scorecard','assign',
    'move','reject','tag','pool','reference','webhook');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.automation_trigger AS ENUM (
    'enter','exit','idle','noreply','replied',
    'scheduled','completed','scorecard','allscorecards','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────────────────── stage_automations: widen ─────────────────────────
ALTER TABLE public.stage_automations
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Untitled automation',
  ADD COLUMN IF NOT EXISTS action public.automation_action NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS "trigger" public.automation_trigger NOT NULL DEFAULT 'enter',
  ADD COLUMN IF NOT EXISTS trigger_days int,
  ADD COLUMN IF NOT EXISTS timing text NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS delay_amount int,
  ADD COLUMN IF NOT EXISTS delay_unit text,
  ADD COLUMN IF NOT EXISTS send_at time,
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS skip_if_replied boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS once_per_candidate boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS position int NOT NULL DEFAULT 0;

-- Legacy columns stay for compatibility but are no longer required inputs.
ALTER TABLE public.stage_automations ALTER COLUMN automation_type SET DEFAULT 'single_email';
ALTER TABLE public.stage_automations ALTER COLUMN trigger_event SET DEFAULT 'on_stage_enter';

-- Backfill job_id from the stage
UPDATE public.stage_automations sa
SET job_id = jhs.job_id
FROM public.job_hiring_stages jhs
WHERE jhs.id = sa.job_hiring_stage_id AND sa.job_id IS NULL;

-- Convert legacy email automations into the new shape
WITH emails AS (
  SELECT
    e.stage_automation_id,
    jsonb_agg(
      jsonb_build_object(
        'subject', e.subject,
        'body_html', e.body,
        'attachments', '[]'::jsonb,
        'delay_days', CASE
          WHEN e.sequence_order = 1 THEN 0
          WHEN e.delay_unit = 'weeks' THEN COALESCE(e.delay_value,0) * 7
          ELSE COALESCE(e.delay_value,0) END
      ) ORDER BY e.sequence_order
    ) AS emails_json,
    (array_agg(e.from_email ORDER BY e.sequence_order))[1] AS from_email,
    (array_agg(e.email_template_id ORDER BY e.sequence_order))[1] AS template_id,
    (array_agg(e.delay_value ORDER BY e.sequence_order))[1] AS first_delay,
    (array_agg(e.delay_unit::text ORDER BY e.sequence_order))[1] AS first_unit,
    count(*) AS n
  FROM public.stage_automation_emails e
  GROUP BY e.stage_automation_id
)
UPDATE public.stage_automations sa
SET
  action = CASE WHEN sa.automation_type = 'email_sequence' THEN 'sequence'::public.automation_action ELSE 'email'::public.automation_action END,
  "trigger" = CASE WHEN sa.trigger_event = 'on_stage_exit' THEN 'exit'::public.automation_trigger ELSE 'enter'::public.automation_trigger END,
  name = CASE WHEN sa.automation_type = 'email_sequence' THEN 'Email sequence' ELSE 'Stage email' END,
  timing = CASE WHEN COALESCE(em.first_delay,0) > 0 THEN 'delay' ELSE 'immediate' END,
  delay_amount = CASE WHEN COALESCE(em.first_delay,0) > 0 THEN (CASE WHEN em.first_unit = 'weeks' THEN em.first_delay * 7 ELSE em.first_delay END) END,
  delay_unit = CASE WHEN COALESCE(em.first_delay,0) > 0 THEN 'days' END,
  config = jsonb_build_object(
    'from', em.from_email,
    'cc', '[]'::jsonb,
    'bcc', '[]'::jsonb,
    'template_id', em.template_id,
    'emails', em.emails_json
  )
FROM emails em
WHERE em.stage_automation_id = sa.id
  AND sa.config = '{}'::jsonb;

-- Sequential positions per stage
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY job_hiring_stage_id ORDER BY created_at) - 1 AS rn
  FROM public.stage_automations
)
UPDATE public.stage_automations sa SET position = r.rn FROM ranked r WHERE r.id = sa.id;

CREATE INDEX IF NOT EXISTS idx_stage_automations_stage_pos ON public.stage_automations (job_hiring_stage_id, position);
CREATE INDEX IF NOT EXISTS idx_stage_automations_job ON public.stage_automations (job_id);

-- ───────────────────────── Runs ─────────────────────────
CREATE TABLE IF NOT EXISTS public.stage_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.stage_automations(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL,
  association_id uuid REFERENCES public.job_candidate_associations(id) ON DELETE CASCADE,
  step int NOT NULL DEFAULT 1,
  status text NOT NULL CHECK (status IN ('scheduled','sent','skipped','failed','cancelled')),
  reason text,
  scheduled_for timestamptz,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stage_automation_runs TO authenticated;
GRANT ALL ON public.stage_automation_runs TO service_role;

ALTER TABLE public.stage_automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view automation runs" ON public.stage_automation_runs;
CREATE POLICY "Members can view automation runs"
  ON public.stage_automation_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stage_automations sa WHERE sa.id = stage_automation_runs.automation_id));

CREATE UNIQUE INDEX IF NOT EXISTS automation_once_per_candidate
  ON public.stage_automation_runs (automation_id, candidate_id, step)
  WHERE status IN ('scheduled','sent');
CREATE INDEX IF NOT EXISTS idx_automation_runs_due ON public.stage_automation_runs (status, scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_automation_runs_assoc ON public.stage_automation_runs (association_id);

CREATE OR REPLACE FUNCTION public.touch_stage_automation_runs()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_touch_stage_automation_runs ON public.stage_automation_runs;
CREATE TRIGGER trg_touch_stage_automation_runs BEFORE UPDATE ON public.stage_automation_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_stage_automation_runs();

-- ───────────────────────── Enqueue function ─────────────────────────
-- Creates run rows for every enabled automation on a stage matching a trigger.
CREATE OR REPLACE FUNCTION public.enqueue_stage_automation_runs(
  p_association_id uuid,
  p_jhs_id uuid,
  p_trigger public.automation_trigger
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_assoc RECORD;
  v_auto RECORD;
  v_email jsonb;
  v_step int;
  v_base timestamptz;
  v_when timestamptz;
  v_count int := 0;
  v_cum_days int;
BEGIN
  IF p_association_id IS NULL OR p_jhs_id IS NULL THEN RETURN 0; END IF;

  SELECT id, candidate_id, job_id, status INTO v_assoc
  FROM job_candidate_associations WHERE id = p_association_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR v_auto IN
    SELECT * FROM stage_automations
    WHERE job_hiring_stage_id = p_jhs_id
      AND "trigger" = p_trigger
      AND is_active = true
    ORDER BY position ASC, created_at ASC
  LOOP
    -- once per candidate: any prior sent/scheduled run → skip
    IF v_auto.once_per_candidate AND EXISTS (
      SELECT 1 FROM stage_automation_runs r
      WHERE r.automation_id = v_auto.id AND r.candidate_id = v_assoc.candidate_id
        AND r.status IN ('scheduled','sent')
    ) THEN
      INSERT INTO stage_automation_runs (automation_id, candidate_id, association_id, step, status, reason)
      VALUES (v_auto.id, v_assoc.candidate_id, v_assoc.id, 1, 'skipped', 'already ran for this candidate');
      CONTINUE;
    END IF;

    -- base time from timing
    v_base := now();
    IF v_auto.timing = 'delay' AND COALESCE(v_auto.delay_amount,0) > 0 THEN
      v_base := now() + CASE v_auto.delay_unit
        WHEN 'hours' THEN make_interval(hours => v_auto.delay_amount)
        ELSE make_interval(days => v_auto.delay_amount) END;
    ELSIF v_auto.timing = 'at_time' AND v_auto.send_at IS NOT NULL THEN
      v_base := (current_date + v_auto.send_at) AT TIME ZONE 'UTC';
      IF v_base <= now() THEN v_base := v_base + interval '1 day'; END IF;
    END IF;

    IF v_auto.action = 'sequence' AND jsonb_typeof(v_auto.config->'emails') = 'array' THEN
      v_step := 0; v_cum_days := 0;
      FOR v_email IN SELECT * FROM jsonb_array_elements(v_auto.config->'emails') LOOP
        v_step := v_step + 1;
        IF v_step > 1 THEN v_cum_days := v_cum_days + COALESCE((v_email->>'delay_days')::int, 0); END IF;
        v_when := v_base + make_interval(days => v_cum_days);
        INSERT INTO stage_automation_runs (automation_id, candidate_id, association_id, step, status, scheduled_for)
        VALUES (v_auto.id, v_assoc.candidate_id, v_assoc.id, v_step, 'scheduled', v_when)
        ON CONFLICT DO NOTHING;
      END LOOP;
    ELSE
      INSERT INTO stage_automation_runs (automation_id, candidate_id, association_id, step, status, scheduled_for)
      VALUES (v_auto.id, v_assoc.candidate_id, v_assoc.id, 1, 'scheduled', v_base)
      ON CONFLICT DO NOTHING;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- Cancel pending runs for a candidate on a stage (optionally keeping one trigger kind alive)
CREATE OR REPLACE FUNCTION public.cancel_stage_automation_runs(
  p_association_id uuid,
  p_jhs_id uuid,
  p_reason text,
  p_keep_trigger public.automation_trigger DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE stage_automation_runs r
  SET status = 'cancelled', reason = p_reason, executed_at = now()
  FROM stage_automations sa
  WHERE sa.id = r.automation_id
    AND r.association_id = p_association_id
    AND r.status = 'scheduled'
    AND (p_jhs_id IS NULL OR sa.job_hiring_stage_id = p_jhs_id)
    AND (p_keep_trigger IS NULL OR sa."trigger" <> p_keep_trigger);
END $$;

-- ───────────────────────── Pipeline triggers ─────────────────────────
DROP TRIGGER IF EXISTS on_candidate_stage_change_automation ON public.job_candidate_associations;
DROP TRIGGER IF EXISTS on_candidate_stage_enter_insert ON public.job_candidate_associations;

CREATE OR REPLACE FUNCTION public.automation_on_association_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.current_stage_id IS NOT NULL AND COALESCE(NEW.status,'active') = 'active' THEN
      PERFORM enqueue_stage_automation_runs(NEW.id, NEW.current_stage_id, 'enter');
    END IF;
    RETURN NEW;
  END IF;

  -- Stage move
  IF NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id THEN
    IF OLD.current_stage_id IS NOT NULL THEN
      PERFORM cancel_stage_automation_runs(NEW.id, OLD.current_stage_id, 'candidate left the stage', 'exit');
      PERFORM enqueue_stage_automation_runs(NEW.id, OLD.current_stage_id, 'exit');
    END IF;
    IF NEW.current_stage_id IS NOT NULL AND COALESCE(NEW.status,'active') = 'active' THEN
      PERFORM enqueue_stage_automation_runs(NEW.id, NEW.current_stage_id, 'enter');
    END IF;
  END IF;

  -- Status transitions
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'rejected' THEN
      PERFORM cancel_stage_automation_runs(NEW.id, NULL, 'candidate was rejected', 'rejected');
      IF NEW.current_stage_id IS NOT NULL THEN
        PERFORM enqueue_stage_automation_runs(NEW.id, NEW.current_stage_id, 'rejected');
      END IF;
    ELSIF NEW.status = 'hired' THEN
      PERFORM cancel_stage_automation_runs(NEW.id, NULL, 'candidate was hired', NULL);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_automation_on_association_change
  AFTER INSERT OR UPDATE OF current_stage_id, status ON public.job_candidate_associations
  FOR EACH ROW EXECUTE FUNCTION public.automation_on_association_change();

-- Candidate replied (inbound mail)
CREATE OR REPLACE FUNCTION public.automation_on_email_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_assoc RECORD;
BEGIN
  IF NEW.direction <> 'received' OR NEW.candidate_id IS NULL THEN RETURN NEW; END IF;
  FOR v_assoc IN
    SELECT id, current_stage_id FROM job_candidate_associations
    WHERE candidate_id = NEW.candidate_id AND status = 'active' AND current_stage_id IS NOT NULL
      AND (NEW.job_id IS NULL OR job_id = NEW.job_id)
  LOOP
    PERFORM enqueue_stage_automation_runs(v_assoc.id, v_assoc.current_stage_id, 'replied');
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_automation_on_email_received ON public.email_logs;
CREATE TRIGGER trg_automation_on_email_received
  AFTER INSERT ON public.email_logs
  FOR EACH ROW EXECUTE FUNCTION public.automation_on_email_received();

-- Interview scheduled
CREATE OR REPLACE FUNCTION public.automation_on_booking_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_stage uuid;
BEGIN
  IF NEW.job_candidate_association_id IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(NEW.job_hiring_stage_id, current_stage_id) INTO v_stage
  FROM job_candidate_associations WHERE id = NEW.job_candidate_association_id;
  IF v_stage IS NOT NULL THEN
    PERFORM enqueue_stage_automation_runs(NEW.job_candidate_association_id, v_stage, 'scheduled');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_automation_on_booking_created ON public.scheduled_bookings;
CREATE TRIGGER trg_automation_on_booking_created
  AFTER INSERT ON public.scheduled_bookings
  FOR EACH ROW EXECUTE FUNCTION public.automation_on_booking_created();

-- Scorecard submitted / every scorecard in
CREATE OR REPLACE FUNCTION public.automation_on_scorecard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_expected int; v_submitted int;
BEGIN
  IF COALESCE(NEW.is_ai_draft,false) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NOT COALESCE(OLD.is_ai_draft,false) THEN RETURN NEW; END IF;
  IF NEW.association_id IS NULL OR NEW.stage_instance_id IS NULL THEN RETURN NEW; END IF;

  PERFORM enqueue_stage_automation_runs(NEW.association_id, NEW.stage_instance_id, 'scorecard');

  SELECT count(*) INTO v_expected FROM stage_interviewer_assignments WHERE job_hiring_stage_id = NEW.stage_instance_id;
  SELECT count(DISTINCT created_by) INTO v_submitted FROM job_stage_scorecards
    WHERE association_id = NEW.association_id AND stage_instance_id = NEW.stage_instance_id AND NOT COALESCE(is_ai_draft,false);
  IF v_expected > 0 AND v_submitted >= v_expected THEN
    PERFORM enqueue_stage_automation_runs(NEW.association_id, NEW.stage_instance_id, 'allscorecards');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_automation_on_scorecard ON public.job_stage_scorecards;
CREATE TRIGGER trg_automation_on_scorecard
  AFTER INSERT OR UPDATE OF is_ai_draft ON public.job_stage_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.automation_on_scorecard();

-- Disabling an automation cancels its pending runs
CREATE OR REPLACE FUNCTION public.automation_on_disable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE stage_automation_runs SET status='cancelled', reason='automation paused', executed_at=now()
    WHERE automation_id = NEW.id AND status = 'scheduled';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_automation_on_disable ON public.stage_automations;
CREATE TRIGGER trg_automation_on_disable
  AFTER UPDATE OF is_active ON public.stage_automations
  FOR EACH ROW EXECUTE FUNCTION public.automation_on_disable();

-- Retire the legacy email queue (nothing pending)
UPDATE public.automation_email_queue SET status='cancelled', updated_at=now() WHERE status='pending';

-- ───────────────────────── Attachment storage policies ─────────────────────────
DROP POLICY IF EXISTS "Members manage automation attachments" ON storage.objects;
CREATE POLICY "Members manage automation attachments"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'automation-attachments' AND EXISTS (
    SELECT 1 FROM public.jobs j WHERE j.id::text = (storage.foldername(name))[1]
  ))
  WITH CHECK (bucket_id = 'automation-attachments' AND EXISTS (
    SELECT 1 FROM public.jobs j WHERE j.id::text = (storage.foldername(name))[1]
  ));