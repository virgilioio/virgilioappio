CREATE OR REPLACE FUNCTION public.clear_rejected_at_on_recovery()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF LOWER(COALESCE(OLD.status,'')) = 'rejected'
     AND LOWER(COALESCE(NEW.status,'')) NOT IN ('rejected','withdrawn') THEN
    NEW.rejected_at := NULL;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS clear_rejected_at_on_recovery ON public.job_candidate_associations;
CREATE TRIGGER clear_rejected_at_on_recovery
BEFORE UPDATE OF status ON public.job_candidate_associations
FOR EACH ROW EXECUTE FUNCTION public.clear_rejected_at_on_recovery();

UPDATE public.job_candidate_associations
   SET rejected_at = NULL
 WHERE rejected_at IS NOT NULL
   AND LOWER(COALESCE(status,'active')) NOT IN ('rejected','withdrawn');