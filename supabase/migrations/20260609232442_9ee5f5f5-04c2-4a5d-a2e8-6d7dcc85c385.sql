
-- 1) Backfill existing job_postings.details with current job department
UPDATE public.job_postings p
SET details = COALESCE(p.details, '{}'::jsonb)
            || jsonb_build_object(
                 'department', j.department,
                 'department_id', j.department_id
               )
FROM public.jobs j
WHERE p.job_id = j.id
  AND j.department IS NOT NULL;

-- 2) Trigger function to keep job_postings.details.department in sync
CREATE OR REPLACE FUNCTION public.sync_job_postings_department()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.department IS DISTINCT FROM OLD.department
     OR NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    UPDATE public.job_postings
       SET details = COALESCE(details, '{}'::jsonb)
                  || jsonb_build_object(
                       'department', NEW.department,
                       'department_id', NEW.department_id
                     )
     WHERE job_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_job_postings_department ON public.jobs;
CREATE TRIGGER trg_sync_job_postings_department
AFTER UPDATE OF department, department_id ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.sync_job_postings_department();
