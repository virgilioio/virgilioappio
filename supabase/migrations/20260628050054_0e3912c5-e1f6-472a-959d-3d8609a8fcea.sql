-- 1) Backfill: ensure every tenant that has any deal_stages has one 'won' and one 'lost'
INSERT INTO public.deal_stages (tenant_id, name, position, stage_type, color)
SELECT t.tenant_id, 'Won',
       COALESCE((SELECT MAX(position) + 1 FROM public.deal_stages WHERE tenant_id = t.tenant_id), 0),
       'won', 'hsl(140 60% 45%)'
FROM (SELECT DISTINCT tenant_id FROM public.deal_stages) t
WHERE NOT EXISTS (
  SELECT 1 FROM public.deal_stages s WHERE s.tenant_id = t.tenant_id AND s.stage_type = 'won'
);

INSERT INTO public.deal_stages (tenant_id, name, position, stage_type, color)
SELECT t.tenant_id, 'Lost',
       COALESCE((SELECT MAX(position) + 1 FROM public.deal_stages WHERE tenant_id = t.tenant_id), 0),
       'lost', 'hsl(0 70% 55%)'
FROM (SELECT DISTINCT tenant_id FROM public.deal_stages) t
WHERE NOT EXISTS (
  SELECT 1 FROM public.deal_stages s WHERE s.tenant_id = t.tenant_id AND s.stage_type = 'lost'
);

-- 2) Protection trigger: prevent deleting / retyping the last 'won' or 'lost' stage
CREATE OR REPLACE FUNCTION public.protect_terminal_deal_stages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.stage_type IN ('won','lost') THEN
      SELECT count(*) INTO v_count
      FROM public.deal_stages
      WHERE tenant_id = OLD.tenant_id
        AND stage_type = OLD.stage_type
        AND id <> OLD.id;
      IF v_count = 0 THEN
        RAISE EXCEPTION 'Cannot remove the % stage — every CRM must keep at least one % stage.', OLD.stage_type, OLD.stage_type
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.stage_type IN ('won','lost') AND NEW.stage_type <> OLD.stage_type THEN
      SELECT count(*) INTO v_count
      FROM public.deal_stages
      WHERE tenant_id = OLD.tenant_id
        AND stage_type = OLD.stage_type
        AND id <> OLD.id;
      IF v_count = 0 THEN
        RAISE EXCEPTION 'Cannot change the type of the only % stage — every CRM must keep at least one % stage.', OLD.stage_type, OLD.stage_type
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_terminal_deal_stages ON public.deal_stages;
CREATE TRIGGER trg_protect_terminal_deal_stages
  BEFORE DELETE OR UPDATE ON public.deal_stages
  FOR EACH ROW EXECUTE FUNCTION public.protect_terminal_deal_stages();

-- 3) Auto-provision Won/Lost when a tenant's first non-terminal stage is created elsewhere
CREATE OR REPLACE FUNCTION public.autoseed_terminal_deal_stages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
BEGIN
  IF NEW.stage_type = 'won' OR NEW.stage_type = 'lost' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(position), -1) INTO v_max FROM public.deal_stages WHERE tenant_id = NEW.tenant_id;

  IF NOT EXISTS (SELECT 1 FROM public.deal_stages WHERE tenant_id = NEW.tenant_id AND stage_type = 'won') THEN
    v_max := v_max + 1;
    INSERT INTO public.deal_stages (tenant_id, name, position, stage_type, color)
    VALUES (NEW.tenant_id, 'Won', v_max, 'won', 'hsl(140 60% 45%)');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.deal_stages WHERE tenant_id = NEW.tenant_id AND stage_type = 'lost') THEN
    v_max := v_max + 1;
    INSERT INTO public.deal_stages (tenant_id, name, position, stage_type, color)
    VALUES (NEW.tenant_id, 'Lost', v_max, 'lost', 'hsl(0 70% 55%)');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autoseed_terminal_deal_stages ON public.deal_stages;
CREATE TRIGGER trg_autoseed_terminal_deal_stages
  AFTER INSERT ON public.deal_stages
  FOR EACH ROW EXECUTE FUNCTION public.autoseed_terminal_deal_stages();