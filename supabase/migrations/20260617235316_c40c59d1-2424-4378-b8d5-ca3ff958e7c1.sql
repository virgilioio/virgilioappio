-- Extend validation_point_resolutions to support the Gio suggestion inbox (added/dismissed)
-- and add a JSON column on job_stage_scorecards to persist ad-hoc "Added from Gio" Q/A.

-- 1) Drop the old CHECK if any, then add a validation trigger that allows the wider set.
DO $$
DECLARE
  conname text;
BEGIN
  SELECT con.conname INTO conname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.nspname = 'public'
    AND rel.relname = 'validation_point_resolutions'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status%';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.validation_point_resolutions DROP CONSTRAINT %I', conname);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.validate_validation_point_resolution_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NULL OR NEW.status NOT IN ('validated','flagged','added','dismissed') THEN
    RAISE EXCEPTION 'Invalid validation_point_resolutions.status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_validation_point_resolution_status_trg
  ON public.validation_point_resolutions;
CREATE TRIGGER validate_validation_point_resolution_status_trg
BEFORE INSERT OR UPDATE ON public.validation_point_resolutions
FOR EACH ROW EXECUTE FUNCTION public.validate_validation_point_resolution_status();

-- 2) Add the JSON column on job_stage_scorecards (the real scorecards table).
ALTER TABLE public.job_stage_scorecards
  ADD COLUMN IF NOT EXISTS gio_added_questions jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.job_stage_scorecards.gio_added_questions IS
  'Array of {id, source_point_index, question, answer} added from Gio''s suggestions for this scorecard.';