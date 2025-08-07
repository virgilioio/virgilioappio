
-- 1) Extend job_candidate_associations with pipeline fields
ALTER TABLE public.job_candidate_associations
  ADD COLUMN IF NOT EXISTS current_stage_id uuid NULL,
  ADD COLUMN IF NOT EXISTS pipeline_position integer NULL,
  ADD COLUMN IF NOT EXISTS entered_stage_at timestamptz NULL;

-- FK to ensure current_stage_id refers to a valid job_hiring_stages row
ALTER TABLE public.job_candidate_associations
  DROP CONSTRAINT IF EXISTS job_candidate_associations_current_stage_id_fkey;
ALTER TABLE public.job_candidate_associations
  ADD CONSTRAINT job_candidate_associations_current_stage_id_fkey
  FOREIGN KEY (current_stage_id) REFERENCES public.job_hiring_stages(id)
  ON DELETE SET NULL;

-- Ensure there is only one association per (job_id, candidate_id)
CREATE UNIQUE INDEX IF NOT EXISTS job_candidate_associations_job_candidate_unique
  ON public.job_candidate_associations (job_id, candidate_id);

-- Helpful indexes for pipeline queries
CREATE INDEX IF NOT EXISTS job_candidate_associations_stage_idx
  ON public.job_candidate_associations (current_stage_id);

CREATE INDEX IF NOT EXISTS job_candidate_associations_job_stage_position_idx
  ON public.job_candidate_associations (job_id, current_stage_id, pipeline_position);

-- 2) Validation: current_stage_id must belong to the same job as the association
CREATE OR REPLACE FUNCTION public.validate_association_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.current_stage_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.job_hiring_stages jhs
      WHERE jhs.id = NEW.current_stage_id
        AND jhs.job_id = NEW.job_id
    ) THEN
      RAISE EXCEPTION 'Selected stage does not belong to the same job';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_validate_association_stage ON public.job_candidate_associations;
CREATE TRIGGER trg_validate_association_stage
BEFORE INSERT OR UPDATE OF current_stage_id
ON public.job_candidate_associations
FOR EACH ROW
EXECUTE FUNCTION public.validate_association_stage();

-- 3) Assign pipeline position and stamp entered_stage_at on stage change
CREATE OR REPLACE FUNCTION public.assign_pipeline_position()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  next_pos integer;
BEGIN
  -- On INSERT, if no explicit position provided, append to end of the (job, stage) column
  IF TG_OP = 'INSERT' THEN
    IF NEW.pipeline_position IS NULL OR NEW.pipeline_position <= 0 THEN
      SELECT COALESCE(MAX(pipeline_position), 0) + 1
        INTO next_pos
      FROM public.job_candidate_associations
      WHERE job_id = NEW.job_id
        AND (current_stage_id IS NOT DISTINCT FROM NEW.current_stage_id);
      NEW.pipeline_position := COALESCE(next_pos, 1);
    END IF;
  END IF;

  -- On UPDATE, when stage changes, reset position and update entered_stage_at
  IF TG_OP = 'UPDATE' AND (NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id) THEN
    NEW.entered_stage_at := now();
    IF NEW.pipeline_position IS NULL OR NEW.pipeline_position <= 0 THEN
      SELECT COALESCE(MAX(pipeline_position), 0) + 1
        INTO next_pos
      FROM public.job_candidate_associations
      WHERE job_id = NEW.job_id
        AND (current_stage_id IS NOT DISTINCT FROM NEW.current_stage_id);
      NEW.pipeline_position := COALESCE(next_pos, 1);
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_assign_pipeline_position ON public.job_candidate_associations;
CREATE TRIGGER trg_assign_pipeline_position
BEFORE INSERT OR UPDATE
ON public.job_candidate_associations
FOR EACH ROW
EXECUTE FUNCTION public.assign_pipeline_position();

-- 4) Stage change history table
CREATE TABLE IF NOT EXISTS public.job_candidate_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.job_candidate_associations(id) ON DELETE CASCADE,
  from_stage_id uuid NULL REFERENCES public.job_hiring_stages(id) ON DELETE SET NULL,
  to_stage_id uuid NULL REFERENCES public.job_hiring_stages(id) ON DELETE SET NULL,
  moved_by uuid NOT NULL DEFAULT auth.uid(),
  moved_at timestamptz NOT NULL DEFAULT now(),
  note text NULL
);

ALTER TABLE public.job_candidate_stage_history ENABLE ROW LEVEL SECURITY;

-- RLS: Members of org or assigned users can view history; platform admins can view all
DROP POLICY IF EXISTS "Members and job-assigned users can view stage history" ON public.job_candidate_stage_history;
CREATE POLICY "Members and job-assigned users can view stage history"
  ON public.job_candidate_stage_history
  FOR SELECT
  USING (
    (EXISTS (
      SELECT 1
      FROM public.job_candidate_associations jca
      JOIN public.jobs j ON jca.job_id = j.id
      JOIN public.members m ON m.organization_id = j.organization_id
      WHERE jca.id = job_candidate_stage_history.association_id
        AND m.user_id = auth.uid()
        AND m.user_status = 'active'
    ))
    OR
    (EXISTS (
      SELECT 1
      FROM public.job_candidate_associations jca
      JOIN public.job_assignments ja ON ja.job_id = jca.job_id
      WHERE jca.id = job_candidate_stage_history.association_id
        AND ja.user_id = auth.uid()
    ))
    OR
    (public.get_user_type_secure() = 'platform_admin')
  );

-- No direct INSERT/UPDATE/DELETE policies needed; inserts will be done via trigger below.

-- 5) Trigger to log stage changes
CREATE OR REPLACE FUNCTION public.log_candidate_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id THEN
    INSERT INTO public.job_candidate_stage_history (association_id, from_stage_id, to_stage_id, moved_by, moved_at)
    VALUES (OLD.id, OLD.current_stage_id, NEW.current_stage_id, auth.uid(), now());
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_log_candidate_stage_change ON public.job_candidate_associations;
CREATE TRIGGER trg_log_candidate_stage_change
AFTER UPDATE OF current_stage_id
ON public.job_candidate_associations
FOR EACH ROW
EXECUTE FUNCTION public.log_candidate_stage_change();
