
-- Add stage_changed_at + probability to deals; auto-update stage_changed_at on stage change.
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS probability numeric;

-- Backfill stage_changed_at with the best signal we have (updated_at) for existing rows.
UPDATE public.deals
   SET stage_changed_at = COALESCE(updated_at, created_at, now())
 WHERE stage_changed_at IS NULL OR stage_changed_at = created_at;

-- Trigger function: reset stage_changed_at whenever stage_id changes.
CREATE OR REPLACE FUNCTION public.deals_stage_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stage_changed_at IS NULL THEN
      NEW.stage_changed_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    NEW.stage_changed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_stage_changed_at ON public.deals;
CREATE TRIGGER trg_deals_stage_changed_at
BEFORE INSERT OR UPDATE OF stage_id ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.deals_stage_changed_at();
