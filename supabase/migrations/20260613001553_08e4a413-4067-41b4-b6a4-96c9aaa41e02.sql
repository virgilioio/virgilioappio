
-- Phase 1: AI Job Health Briefing — schema

-- 1) Jobs: hiring target fields
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS budget_salary_min numeric,
  ADD COLUMN IF NOT EXISTS budget_salary_max numeric,
  ADD COLUMN IF NOT EXISTS budget_currency text NOT NULL DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS budget_period text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS target_fill_date date,
  ADD COLUMN IF NOT EXISTS must_have_skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS location_requirement text NOT NULL DEFAULT 'onsite';

DO $$ BEGIN
  ALTER TABLE public.jobs ADD CONSTRAINT jobs_budget_period_check CHECK (budget_period IN ('monthly','annual'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.jobs ADD CONSTRAINT jobs_location_requirement_check CHECK (location_requirement IN ('onsite','hybrid','remote'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) stage_events (append-only)
CREATE TABLE IF NOT EXISTS public.stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL,
  from_stage text,
  to_stage text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  reason text,
  entry_channel text
);
CREATE INDEX IF NOT EXISTS stage_events_job_occurred_idx ON public.stage_events (job_id, occurred_at);
CREATE INDEX IF NOT EXISTS stage_events_candidate_job_idx ON public.stage_events (candidate_id, job_id);

GRANT SELECT, INSERT ON public.stage_events TO authenticated;
GRANT ALL ON public.stage_events TO service_role;

ALTER TABLE public.stage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read stage_events"
  ON public.stage_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = stage_events.job_id
        AND public.user_has_tenant_access(j.tenant_id)
    )
  );

CREATE POLICY "Tenant members can insert stage_events"
  ON public.stage_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = stage_events.job_id
        AND public.user_has_tenant_access(j.tenant_id)
    )
  );
-- No UPDATE/DELETE policies → append-only for non-service roles.

-- 3) Backfill from existing job_candidate_associations
INSERT INTO public.stage_events (job_id, candidate_id, from_stage, to_stage, occurred_at, actor_id, reason, entry_channel)
SELECT
  jca.job_id,
  jca.candidate_id,
  NULL,
  COALESCE(jca.current_stage_id::text, jca.status, 'unknown'),
  jca.created_at,
  jca.added_by,
  'backfill',
  NULL
FROM public.job_candidate_associations jca
WHERE NOT EXISTS (
  SELECT 1 FROM public.stage_events se
  WHERE se.candidate_id = jca.candidate_id AND se.job_id = jca.job_id AND se.from_stage IS NULL
);

INSERT INTO public.stage_events (job_id, candidate_id, from_stage, to_stage, occurred_at, actor_id, reason, entry_channel)
SELECT
  jca.job_id,
  jca.candidate_id,
  jca.current_stage_id::text,
  jca.status,
  COALESCE(jca.rejected_at, jca.hired_at, jca.updated_at),
  COALESCE(jca.rejected_by, jca.hired_by),
  'backfill',
  NULL
FROM public.job_candidate_associations jca
WHERE jca.status IN ('hired','rejected','withdrawn')
  AND NOT EXISTS (
    SELECT 1 FROM public.stage_events se
    WHERE se.candidate_id = jca.candidate_id AND se.job_id = jca.job_id AND se.to_stage = jca.status
  );

-- 4) Trigger to log future stage / status changes
CREATE OR REPLACE FUNCTION public.log_stage_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from text;
  v_to text;
  v_reason text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.stage_events (job_id, candidate_id, from_stage, to_stage, occurred_at, actor_id, reason, entry_channel)
    VALUES (NEW.job_id, NEW.candidate_id, NULL, COALESCE(NEW.current_stage_id::text, NEW.status, 'unknown'),
            NEW.created_at, NEW.added_by, NULL, NULL);
    RETURN NEW;
  END IF;

  IF NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id THEN
    v_from := OLD.current_stage_id::text;
    v_to := NEW.current_stage_id::text;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_from := OLD.status;
    v_to := NEW.status;
    IF NEW.status IN ('rejected','withdrawn','hired') THEN
      v_reason := NEW.status;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.stage_events (job_id, candidate_id, from_stage, to_stage, occurred_at, actor_id, reason, entry_channel)
  VALUES (NEW.job_id, NEW.candidate_id, v_from, v_to, now(),
          COALESCE(NEW.rejected_by, NEW.hired_by), v_reason, NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_stage_event_ins ON public.job_candidate_associations;
DROP TRIGGER IF EXISTS log_stage_event_upd ON public.job_candidate_associations;

CREATE TRIGGER log_stage_event_ins
  AFTER INSERT ON public.job_candidate_associations
  FOR EACH ROW EXECUTE FUNCTION public.log_stage_event();

CREATE TRIGGER log_stage_event_upd
  AFTER UPDATE OF current_stage_id, status ON public.job_candidate_associations
  FOR EACH ROW EXECUTE FUNCTION public.log_stage_event();

-- 5) job_briefings cache
CREATE TABLE IF NOT EXISTS public.job_briefings (
  job_id uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  snapshot_hash text NOT NULL,
  snapshot jsonb NOT NULL,
  briefing jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.job_briefings TO authenticated;
GRANT ALL ON public.job_briefings TO service_role;

ALTER TABLE public.job_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read job_briefings"
  ON public.job_briefings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_briefings.job_id
        AND public.user_has_tenant_access(j.tenant_id)
    )
  );
-- Writes are restricted to service_role (Phase 3 edge function).
