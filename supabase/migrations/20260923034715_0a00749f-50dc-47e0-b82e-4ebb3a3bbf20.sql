ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS calendar_color_index smallint;

WITH ordered AS (
  SELECT id,
         (ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at NULLS LAST, id) - 1) % 6 AS idx
  FROM public.members
)
UPDATE public.members m
SET calendar_color_index = ordered.idx
FROM ordered
WHERE ordered.id = m.id AND m.calendar_color_index IS NULL;

CREATE OR REPLACE FUNCTION public.assign_member_calendar_color()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used smallint[];
  candidate smallint;
BEGIN
  IF NEW.calendar_color_index IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(array_agg(calendar_color_index), ARRAY[]::smallint[])
  INTO used
  FROM public.members
  WHERE tenant_id = NEW.tenant_id AND calendar_color_index IS NOT NULL;

  FOR candidate IN 0..5 LOOP
    IF NOT (candidate = ANY(used)) THEN
      NEW.calendar_color_index := candidate;
      RETURN NEW;
    END IF;
  END LOOP;

  SELECT (COUNT(*) % 6)::smallint INTO NEW.calendar_color_index
  FROM public.members
  WHERE tenant_id = NEW.tenant_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_member_calendar_color_trg ON public.members;
CREATE TRIGGER assign_member_calendar_color_trg
BEFORE INSERT ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.assign_member_calendar_color();