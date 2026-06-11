-- 1) Data: publish the currently-open Virgilio posting
UPDATE public.job_postings SET is_active = true
WHERE id = 'ad57fc13-80f6-4c48-b450-10d5b9434eb6';

-- 2) Trigger: keep job_postings.is_active in sync with jobs.status
CREATE OR REPLACE FUNCTION public.sync_job_postings_active_on_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'open' THEN
      -- Activate the most recently created posting for this job
      UPDATE public.job_postings jp
         SET is_active = true,
             updated_at = now()
       WHERE jp.id = (
         SELECT id FROM public.job_postings
          WHERE job_id = NEW.id
          ORDER BY created_at DESC
          LIMIT 1
       )
         AND jp.is_active = false;
    ELSIF NEW.status IN ('closed', 'archived') THEN
      UPDATE public.job_postings
         SET is_active = false,
             updated_at = now()
       WHERE job_id = NEW.id
         AND is_active = true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_job_postings_active_on_status ON public.jobs;
CREATE TRIGGER trg_sync_job_postings_active_on_status
AFTER UPDATE OF status ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.sync_job_postings_active_on_status();