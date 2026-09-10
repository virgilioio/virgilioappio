CREATE OR REPLACE FUNCTION public.get_candidate_activities(p_candidate_id uuid, p_job_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, user_id uuid, organization_id uuid, activity_type activity_type, title text, description text, metadata jsonb, entity_type text, entity_id uuid, created_at timestamp with time zone, author_first_name text, author_last_name text, author_email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_org_id UUID;
  v_user_type TEXT;
  v_has_access BOOLEAN;
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT c.organization_id INTO v_org_id FROM public.candidates c WHERE c.id = p_candidate_id;
  IF v_org_id IS NULL THEN
    SELECT j.organization_id INTO v_org_id
    FROM public.job_candidate_associations jca
    JOIN public.jobs j ON j.id = jca.job_id
    WHERE jca.candidate_id = p_candidate_id
    LIMIT 1;
  END IF;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Candidate not found or has no organization: %', p_candidate_id;
  END IF;

  v_user_type := public.get_user_type_secure();
  v_has_access := public.user_has_org_hierarchy_access(v_org_id);
  IF NOT (v_user_type = 'platform_admin' OR v_has_access) THEN
    RAISE EXCEPTION 'Access denied to candidate activities. User: %, Candidate Org: %, User Type: %, Has Access: %',
      v_current_user, v_org_id, v_user_type, v_has_access;
  END IF;

  RETURN QUERY
  WITH matched AS (
    SELECT a.id, a.user_id, a.organization_id, a.activity_type, a.title, a.description,
           a.metadata, a.entity_type, a.entity_id, a.created_at
    FROM public.activities a
    WHERE a.entity_id = p_candidate_id
      AND a.entity_type = 'candidate'
      AND (p_job_id IS NULL OR a.metadata @> jsonb_build_object('job_id', p_job_id::text))
    UNION
    SELECT a.id, a.user_id, a.organization_id, a.activity_type, a.title, a.description,
           a.metadata, a.entity_type, a.entity_id, a.created_at
    FROM public.activities a
    WHERE a.metadata @> jsonb_build_object('candidate_id', p_candidate_id::text)
      AND (p_job_id IS NULL OR a.metadata @> jsonb_build_object('job_id', p_job_id::text))
    UNION
    -- Email activities whose linked email record belongs to the job, even when the
    -- activity metadata itself never recorded job_id.
    SELECT a.id, a.user_id, a.organization_id, a.activity_type, a.title, a.description,
           a.metadata, a.entity_type, a.entity_id, a.created_at
    FROM public.activities a
    JOIN public.email_logs e
      ON e.id::text = a.metadata->>'email_log_id'
    WHERE p_job_id IS NOT NULL
      AND a.entity_id = p_candidate_id
      AND a.entity_type = 'candidate'
      AND a.activity_type IN ('candidate_email_sent','candidate_email_received','candidate_email_automated')
      AND e.candidate_id = p_candidate_id
      AND e.job_id = p_job_id
  )
  SELECT
    m.id, m.user_id, m.organization_id, m.activity_type, m.title, m.description,
    m.metadata, m.entity_type, m.entity_id, m.created_at,
    p.first_name AS author_first_name,
    p.last_name AS author_last_name,
    COALESCE(p.email, '') AS author_email
  FROM matched m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  ORDER BY m.created_at DESC;
END;
$function$;