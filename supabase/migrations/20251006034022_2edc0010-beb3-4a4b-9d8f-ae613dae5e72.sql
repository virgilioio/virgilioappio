-- RPC: Get pipeline global metrics
-- Respects RLS: scopes to user's org and assigned jobs
-- Returns aggregate metrics across visible jobs

CREATE OR REPLACE FUNCTION public.get_pipeline_global_metrics(
  user_ids uuid[] DEFAULT NULL,
  job_statuses text[] DEFAULT NULL,
  search_term text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb;
  org_id uuid;
  u_type text;
  is_admin_or_owner boolean;
BEGIN
  -- Get user's org context
  SELECT organization_id, user_type INTO org_id, u_type
  FROM public.members
  WHERE user_id = auth.uid() AND user_status = 'active'
  LIMIT 1;
  
  is_admin_or_owner := (u_type IN ('platform_admin', 'workspace_owner', 'member') 
                        AND EXISTS (SELECT 1 FROM public.members WHERE user_id = auth.uid() AND member_role = 'admin'));
  
  -- Build scope: jobs in org, filtered by status/search, and by assignments if not admin
  WITH scoped_jobs AS (
    SELECT DISTINCT j.id
    FROM public.jobs j
    WHERE j.organization_id = org_id
      AND (job_statuses IS NULL OR j.status::text = ANY(job_statuses))
      AND (search_term IS NULL OR j.title ILIKE '%' || search_term || '%')
      AND (
        is_admin_or_owner 
        OR EXISTS (SELECT 1 FROM public.job_assignments ja WHERE ja.job_id = j.id AND ja.user_id = auth.uid())
      )
      AND (
        user_ids IS NULL 
        OR EXISTS (SELECT 1 FROM public.job_assignments ja WHERE ja.job_id = j.id AND ja.user_id = ANY(user_ids))
      )
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
$$;

-- RPC: Get per-job pipeline metrics
-- Returns metrics for each job_id: active candidates, stage counts, conversion data

CREATE OR REPLACE FUNCTION public.get_pipeline_job_metrics(job_ids uuid[])
RETURNS TABLE(
  job_id uuid,
  active_candidates integer,
  stages jsonb,
  overall_start_count integer,
  overall_hired_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH job_stages_data AS (
    SELECT
      jhs.job_id,
      jhs.id as jhs_id,
      jhs.position,
      js.id as stage_id,
      js.stage_name,
      js.stage_type
    FROM public.job_hiring_stages jhs
    JOIN public.job_stages js ON js.id = jhs.stage_id
    WHERE jhs.job_id = ANY(job_ids)
  ),
  stage_counts AS (
    SELECT
      jsd.job_id,
      jsd.jhs_id,
      jsd.stage_id,
      jsd.stage_name,
      jsd.stage_type,
      jsd.position,
      COUNT(jca.id) as count_in_stage
    FROM job_stages_data jsd
    LEFT JOIN public.job_candidate_associations jca 
      ON jca.current_stage_id = jsd.jhs_id 
      AND jca.status = 'active'
    GROUP BY jsd.job_id, jsd.jhs_id, jsd.stage_id, jsd.stage_name, jsd.stage_type, jsd.position
  ),
  first_stage_counts AS (
    SELECT
      sc.job_id,
      sc.count_in_stage as first_count
    FROM stage_counts sc
    WHERE sc.position = (SELECT MIN(position) FROM stage_counts sc2 WHERE sc2.job_id = sc.job_id)
  ),
  hired_counts AS (
    SELECT
      jca.job_id,
      COUNT(*) as hired_count
    FROM public.job_candidate_associations jca
    WHERE jca.job_id = ANY(job_ids) AND jca.status = 'hired'
    GROUP BY jca.job_id
  )
  SELECT
    j.id as job_id,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.job_candidate_associations jca2
      JOIN public.job_hiring_stages jhs2 ON jhs2.id = jca2.current_stage_id
      JOIN public.job_stages js2 ON js2.id = jhs2.stage_id
      WHERE jca2.job_id = j.id 
        AND jca2.status = 'active'
        AND js2.stage_type NOT IN ('offer', 'onboarding')
    ), 0) as active_candidates,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'stage_id', sc.stage_id,
          'stage_name', sc.stage_name,
          'stage_type', sc.stage_type,
          'count_in_stage', sc.count_in_stage,
          'position', sc.position
        ) ORDER BY sc.position
      )
      FROM stage_counts sc
      WHERE sc.job_id = j.id
    ), '[]'::jsonb) as stages,
    COALESCE((SELECT fsc.first_count::integer FROM first_stage_counts fsc WHERE fsc.job_id = j.id), 0) as overall_start_count,
    COALESCE((SELECT hc.hired_count::integer FROM hired_counts hc WHERE hc.job_id = j.id), 0) as overall_hired_count
  FROM unnest(job_ids) as j(id);
END;
$$;