-- Fix ordering in handle_new_job_defaults to respect stage_priority
CREATE OR REPLACE FUNCTION public.handle_new_job_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.job_hiring_stages (job_id, stage_id, position, created_by)
  SELECT 
    NEW.id,
    d.stage_id,
    ROW_NUMBER() OVER (ORDER BY d.pri ASC, d.created_at ASC, d.stage_id ASC) AS rn,
    auth.uid()
  FROM (
    SELECT 
      id AS stage_id,
      COALESCE(stage_priority, 500) AS pri,
      created_at
    FROM public.job_stages
    WHERE is_active = true AND is_default = true
  ) d;

  RETURN NEW;
END;
$function$;

-- Fix ordering in backfill_default_stages_to_all_jobs to respect stage_priority
CREATE OR REPLACE FUNCTION public.backfill_default_stages_to_all_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  added integer := 0;
BEGIN
  WITH defaults AS (
    SELECT id AS stage_id, COALESCE(stage_priority, 500) AS pri, created_at
    FROM public.job_stages
    WHERE is_active = true AND is_default = true
  ),
  jobs_list AS (
    SELECT id AS job_id FROM public.jobs
  ),
  missing AS (
    SELECT j.job_id, d.stage_id, d.pri, d.created_at
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
      ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY pri ASC, created_at ASC, stage_id ASC) AS rn
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
$function$;

-- Resequence existing job_hiring_stages across all jobs so defaults with priority come first
WITH joined AS (
  SELECT 
    jhs.id,
    jhs.job_id,
    jhs.stage_id,
    jhs.position AS old_pos,
    js.is_default,
    COALESCE(js.stage_priority, 500) AS pri,
    js.created_at AS stage_created
  FROM public.job_hiring_stages jhs
  JOIN public.job_stages js ON js.id = jhs.stage_id
), ranked AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY job_id 
      ORDER BY CASE WHEN is_default THEN 0 ELSE 1 END,
               pri ASC,
               stage_created ASC,
               old_pos ASC,
               stage_id ASC
    ) AS new_pos
  FROM joined
)
UPDATE public.job_hiring_stages jhs
SET position = r.new_pos,
    updated_at = now()
FROM ranked r
WHERE jhs.id = r.id AND jhs.position IS DISTINCT FROM r.new_pos;