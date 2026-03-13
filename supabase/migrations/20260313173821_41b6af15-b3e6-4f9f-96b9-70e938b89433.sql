
-- Propagate AR stage to all jobs, shifting positions in descending order
DO $$
DECLARE
  ar_stage_id uuid;
  job_record RECORD;
  pos_record RECORD;
BEGIN
  SELECT id INTO ar_stage_id FROM public.job_stages WHERE stage_type = 'application_review' LIMIT 1;
  
  IF ar_stage_id IS NULL THEN
    RAISE EXCEPTION 'Application Review stage not found';
  END IF;
  
  FOR job_record IN SELECT id FROM public.jobs LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.job_hiring_stages WHERE job_id = job_record.id AND stage_id = ar_stage_id
    ) THEN
      -- Shift each position one by one, from highest to lowest
      FOR pos_record IN 
        SELECT position FROM public.job_hiring_stages 
        WHERE job_id = job_record.id 
        ORDER BY position DESC
      LOOP
        UPDATE public.job_hiring_stages 
        SET position = pos_record.position + 1 
        WHERE job_id = job_record.id AND position = pos_record.position;
      END LOOP;
      
      -- Insert AR stage at position 0
      INSERT INTO public.job_hiring_stages (job_id, stage_id, position)
      VALUES (job_record.id, ar_stage_id, 0);
    END IF;
  END LOOP;
  
  -- Mark as default for future jobs
  UPDATE public.job_stages SET is_default = true WHERE id = ar_stage_id;
END $$;

-- Backfill associations with NULL current_stage_id
UPDATE public.job_candidate_associations jca
SET 
  current_stage_id = jhs.id,
  entered_stage_at = COALESCE(jca.entered_stage_at, jca.created_at)
FROM public.job_hiring_stages jhs
JOIN public.job_stages js ON js.id = jhs.stage_id
WHERE jca.job_id = jhs.job_id
  AND js.stage_type = 'application_review'
  AND jca.current_stage_id IS NULL
  AND jca.status = 'active';

-- Update get_pipeline_global_metrics RPC
CREATE OR REPLACE FUNCTION public.get_pipeline_global_metrics(
  user_ids uuid[] DEFAULT NULL::uuid[],
  job_statuses text[] DEFAULT NULL::text[],
  search_term text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
  is_platform_admin boolean;
BEGIN
  is_platform_admin := (public.get_user_type_secure() = 'platform_admin');
  
  WITH scoped_jobs AS (
    SELECT DISTINCT j.id
    FROM public.jobs j
    WHERE 
      (is_platform_admin OR 
       EXISTS (SELECT 1 FROM public.job_assignments ja WHERE ja.job_id = j.id AND ja.user_id = auth.uid()))
      AND (job_statuses IS NULL OR j.status::text = ANY(job_statuses))
      AND (search_term IS NULL OR j.title ILIKE '%' || search_term || '%')
      AND (user_ids IS NULL OR 
           EXISTS (SELECT 1 FROM public.job_assignments ja WHERE ja.job_id = j.id AND ja.user_id = ANY(user_ids)))
  ),
  active_jobs_count AS (
    SELECT COUNT(*) as cnt
    FROM scoped_jobs sj
    JOIN public.jobs j ON j.id = sj.id
    WHERE j.status = 'open'
  ),
  application_review_candidates AS (
    SELECT jca.id, jca.created_at, jca.entered_stage_at
    FROM public.job_candidate_associations jca
    JOIN scoped_jobs sj ON sj.id = jca.job_id
    JOIN public.job_hiring_stages jhs ON jhs.id = jca.current_stage_id
    JOIN public.job_stages js ON js.id = jhs.stage_id
    WHERE jca.status = 'active' 
      AND js.stage_type = 'application_review'
  ),
  recruiting_process_candidates AS (
    SELECT jca.id
    FROM public.job_candidate_associations jca
    JOIN scoped_jobs sj ON sj.id = jca.job_id
    JOIN public.job_hiring_stages jhs ON jhs.id = jca.current_stage_id
    JOIN public.job_stages js ON js.id = jhs.stage_id
    WHERE jca.status = 'active' 
      AND js.stage_type NOT IN ('offer', 'onboarding', 'application_review')
  ),
  avg_days_calc AS (
    SELECT AVG(EXTRACT(EPOCH FROM (now() - COALESCE(entered_stage_at, created_at))) / 86400) as avg_days
    FROM application_review_candidates
  )
  SELECT jsonb_build_object(
    'active_jobs', COALESCE((SELECT cnt FROM active_jobs_count), 0),
    'application_review_count', COALESCE((SELECT COUNT(*) FROM application_review_candidates), 0),
    'avg_days_in_application_review', COALESCE((SELECT ROUND(avg_days::numeric, 1) FROM avg_days_calc), NULL),
    'active_candidates_count', COALESCE((SELECT COUNT(*) FROM recruiting_process_candidates), 0)
  ) INTO result;
  
  RETURN result;
END;
$function$;
