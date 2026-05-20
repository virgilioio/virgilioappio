CREATE OR REPLACE FUNCTION public.get_candidate_kpis(_tenant_id uuid)
RETURNS TABLE (
  total bigint,
  in_active_pipeline bigint,
  awaiting_outreach bigint,
  favorites bigint,
  new_this_week bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_has_tenant_access(_tenant_id) THEN
    RAISE EXCEPTION 'Access denied to tenant';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT id, created_at
    FROM public.candidates
    WHERE tenant_id = _tenant_id
      AND deleted_at IS NULL
  ),
  active AS (
    SELECT DISTINCT jca.candidate_id
    FROM public.job_candidate_associations jca
    JOIN base b ON b.id = jca.candidate_id
    WHERE jca.status IS NULL OR jca.status NOT IN ('rejected','hired','withdrawn','archived')
  ),
  outreach AS (
    SELECT DISTINCT el.candidate_id
    FROM public.email_logs el
    JOIN base b ON b.id = el.candidate_id
    WHERE el.direction = 'outbound' AND el.candidate_id IS NOT NULL
  ),
  fav AS (
    SELECT DISTINCT jca.candidate_id
    FROM public.job_candidate_associations jca
    JOIN base b ON b.id = jca.candidate_id
    WHERE jca.is_favorite = true
  )
  SELECT
    (SELECT count(*) FROM base)::bigint,
    (SELECT count(*) FROM active)::bigint,
    (SELECT count(*) FROM active a WHERE a.candidate_id NOT IN (SELECT candidate_id FROM outreach))::bigint,
    (SELECT count(*) FROM fav)::bigint,
    (SELECT count(*) FROM base WHERE created_at >= now() - interval '7 days')::bigint;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_candidate_kpis(uuid) TO authenticated;