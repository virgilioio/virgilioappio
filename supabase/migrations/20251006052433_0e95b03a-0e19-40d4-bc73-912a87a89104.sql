-- Fix pipeline metrics to properly handle platform admin access and job assignments

-- Drop and recreate get_pipeline_global_metrics with corrected logic
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
  -- Check if user is platform admin
  is_platform_admin := (public.get_user_type_secure() = 'platform_admin');
  
  -- Build scope based on user role
  WITH scoped_jobs AS (
    SELECT DISTINCT j.id
    FROM public.jobs j
    WHERE 
      -- Platform admins see ALL jobs
      (is_platform_admin OR 
       -- Non-admins see only jobs they're assigned to
       EXISTS (SELECT 1 FROM public.job_assignments ja WHERE ja.job_id = j.id AND ja.user_id = auth.uid()))
      -- Apply status filter
      AND (job_statuses IS NULL OR j.status::text = ANY(job_statuses))
      -- Apply search filter
      AND (search_term IS NULL OR j.title ILIKE '%' || search_term || '%')
      -- Apply user assignment filter if specified
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
    WHERE jca.status = 'active' AND jca.current_stage_id IS NULL
  ),
  recruiting_process_candidates AS (
    SELECT jca.id
    FROM public.job_candidate_associations jca
    JOIN scoped_jobs sj ON sj.id = jca.job_id
    JOIN public.job_hiring_stages jhs ON jhs.id = jca.current_stage_id
    JOIN public.job_stages js ON js.id = jhs.stage_id
    WHERE jca.status = 'active' 
      AND js.stage_type NOT IN ('offer', 'onboarding')
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