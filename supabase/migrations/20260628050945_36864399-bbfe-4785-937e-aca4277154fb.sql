-- 1) Trigger to sync deals.won_at / lost_at from deal_stages.stage_type
CREATE OR REPLACE FUNCTION public.sync_deal_terminal_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_type text;
BEGIN
  IF NEW.stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT stage_type INTO v_stage_type
  FROM public.deal_stages
  WHERE id = NEW.stage_id;

  IF v_stage_type = 'won' THEN
    IF NEW.won_at IS NULL THEN
      NEW.won_at := now();
    END IF;
    NEW.lost_at := NULL;
    NEW.lost_reason := NULL;
  ELSIF v_stage_type = 'lost' THEN
    IF NEW.lost_at IS NULL THEN
      NEW.lost_at := now();
    END IF;
    NEW.won_at := NULL;
  ELSE
    -- open or unknown
    NEW.won_at := NULL;
    NEW.lost_at := NULL;
    NEW.lost_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_deal_terminal_timestamps ON public.deals;
CREATE TRIGGER trg_sync_deal_terminal_timestamps
  BEFORE INSERT OR UPDATE OF stage_id ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.sync_deal_terminal_timestamps();

-- 2) Backfill existing deals based on their current stage_type
UPDATE public.deals d
SET won_at = COALESCE(d.updated_at, d.created_at, now()),
    lost_at = NULL,
    lost_reason = NULL
FROM public.deal_stages s
WHERE d.stage_id = s.id
  AND s.stage_type = 'won'
  AND d.won_at IS NULL;

UPDATE public.deals d
SET lost_at = COALESCE(d.updated_at, d.created_at, now()),
    won_at = NULL
FROM public.deal_stages s
WHERE d.stage_id = s.id
  AND s.stage_type = 'lost'
  AND d.lost_at IS NULL;

-- Clear stale terminal markers on deals that are in open stages
UPDATE public.deals d
SET won_at = NULL,
    lost_at = NULL,
    lost_reason = NULL
FROM public.deal_stages s
WHERE d.stage_id = s.id
  AND s.stage_type = 'open'
  AND (d.won_at IS NOT NULL OR d.lost_at IS NOT NULL);
