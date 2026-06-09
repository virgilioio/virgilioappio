
-- 1) Backfill: deactivate postings whose parent job is not open
UPDATE public.job_postings p
SET is_active = false
FROM public.jobs j
WHERE p.job_id = j.id
  AND j.status <> 'open'
  AND p.is_active = true;

-- 2) Trigger: auto-deactivate postings when a job leaves 'open'
CREATE OR REPLACE FUNCTION public.deactivate_postings_on_job_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND OLD.status = 'open'
     AND NEW.status <> 'open' THEN
    UPDATE public.job_postings
       SET is_active = false
     WHERE job_id = NEW.id
       AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deactivate_postings_on_job_close ON public.jobs;
CREATE TRIGGER trg_deactivate_postings_on_job_close
AFTER UPDATE OF status ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.deactivate_postings_on_job_close();
