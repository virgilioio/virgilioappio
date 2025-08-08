-- 1) Function: backfill missing default stages to all jobs
CREATE OR REPLACE FUNCTION public.backfill_default_stages_to_all_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  added integer := 0;
BEGIN
  WITH defaults AS (
    SELECT id AS stage_id
    FROM public.job_stages
    WHERE is_active = true AND is_default = true
  ),
  jobs_list AS (
    SELECT id AS job_id
    FROM public.jobs
  ),
  missing AS (
    SELECT j.job_id, d.stage_id
    FROM jobs_list j
    CROSS JOIN defaults d
    LEFT JOIN public.job_hiring_stages x
      ON x.job_id = j.job_id AND x.stage_id = d.stage_id
    WHERE x.id IS NULL
  ),
  numbered AS (
    SELECT 
      job_id, 
      stage_id,
      ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY stage_id) AS rn
    FROM missing
  ),
  base_pos AS (
    SELECT job_id, COALESCE(MAX(position),0) AS base
    FROM public.job_hiring_stages
    GROUP BY job_id
  ),
  ins AS (
    INSERT INTO public.job_hiring_stages (job_id, stage_id, position, created_by)
    SELECT n.job_id, n.stage_id, COALESCE(b.base,0) + n.rn, auth.uid()
    FROM numbered n
    LEFT JOIN base_pos b ON b.job_id = n.job_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO added FROM ins;

  RETURN added;
END;
$$;

-- 2) Trigger function: when a new default stage is created or activated, add to all jobs
CREATE OR REPLACE FUNCTION public.handle_new_default_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.is_default = true AND NEW.is_active = true THEN
    WITH jobs_list AS (
      SELECT id AS job_id FROM public.jobs
    ),
    missing AS (
      SELECT j.job_id
      FROM jobs_list j
      LEFT JOIN public.job_hiring_stages x
        ON x.job_id = j.job_id AND x.stage_id = NEW.id
      WHERE x.id IS NULL
    ),
    base_pos AS (
      SELECT job_id, COALESCE(MAX(position),0) AS base
      FROM public.job_hiring_stages
      GROUP BY job_id
    )
    INSERT INTO public.job_hiring_stages (job_id, stage_id, position, created_by)
    SELECT m.job_id, NEW.id, COALESCE(b.base,0) + 1, auth.uid()
    FROM missing m
    LEFT JOIN base_pos b ON b.job_id = m.job_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Trigger function: when a new job is created, add all current default stages to its plan
CREATE OR REPLACE FUNCTION public.handle_new_job_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  WITH defaults AS (
    SELECT id AS stage_id
    FROM public.job_stages
    WHERE is_active = true AND is_default = true
    ORDER BY created_at ASC, id ASC
  ),
  numbered AS (
    SELECT stage_id, ROW_NUMBER() OVER (ORDER BY stage_id) AS rn FROM defaults
  )
  INSERT INTO public.job_hiring_stages (job_id, stage_id, position, created_by)
  SELECT NEW.id, n.stage_id, n.rn, auth.uid()
  FROM numbered n;

  RETURN NEW;
END;
$$;

-- 4) Create triggers
DROP TRIGGER IF EXISTS tr_job_stages_default_insert ON public.job_stages;
CREATE TRIGGER tr_job_stages_default_insert
AFTER INSERT ON public.job_stages
FOR EACH ROW
WHEN (NEW.is_default = true AND NEW.is_active = true)
EXECUTE FUNCTION public.handle_new_default_stage();

DROP TRIGGER IF EXISTS tr_job_stages_default_update ON public.job_stages;
CREATE TRIGGER tr_job_stages_default_update
AFTER UPDATE OF is_default, is_active ON public.job_stages
FOR EACH ROW
WHEN (
  NEW.is_default = true AND NEW.is_active = true AND (
    COALESCE(OLD.is_default, false) IS DISTINCT FROM NEW.is_default OR
    COALESCE(OLD.is_active, false) IS DISTINCT FROM NEW.is_active
  )
)
EXECUTE FUNCTION public.handle_new_default_stage();

DROP TRIGGER IF EXISTS tr_jobs_insert_defaults ON public.jobs;
CREATE TRIGGER tr_jobs_insert_defaults
AFTER INSERT ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_job_defaults();

-- 5) Backfill now
SELECT public.backfill_default_stages_to_all_jobs();