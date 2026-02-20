
-- Drop the existing function so we can recreate with the same return type
DROP FUNCTION IF EXISTS public.get_candidate_activities(uuid, uuid);

-- Recreate with fallback org lookup for public applicants (null organization_id)
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
  -- Get current user
  v_current_user := auth.uid();
  
  -- Early check: user must be authenticated
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Get the candidate's organization
  SELECT c.organization_id INTO v_org_id
  FROM public.candidates c
  WHERE c.id = p_candidate_id;
  
  -- Fallback: infer org from job association (covers public applicants with null organization_id)
  IF v_org_id IS NULL THEN
    SELECT j.organization_id INTO v_org_id
    FROM public.job_candidate_associations jca
    JOIN public.jobs j ON j.id = jca.job_id
    WHERE jca.candidate_id = p_candidate_id
    LIMIT 1;
  END IF;

  -- Check if candidate exists / has an org we can infer
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Candidate not found or has no organization: %', p_candidate_id;
  END IF;
  
  -- Get user type and access permissions
  v_user_type := public.get_user_type_secure();
  v_has_access := public.user_has_org_hierarchy_access(v_org_id);
  
  -- Check if user has access to this organization
  IF NOT (v_user_type = 'platform_admin' OR v_has_access) THEN
    RAISE EXCEPTION 'Access denied to candidate activities. User: %, Candidate Org: %, User Type: %, Has Access: %', 
      v_current_user, v_org_id, v_user_type, v_has_access;
  END IF;
  
  -- Return activities related to this candidate with author info
  RETURN QUERY
  SELECT 
    a.id,
    a.user_id,
    a.organization_id,
    a.activity_type,
    a.title,
    a.description,
    a.metadata,
    a.entity_type,
    a.entity_id,
    a.created_at,
    p.first_name AS author_first_name,
    p.last_name AS author_last_name,
    COALESCE(p.email, '') AS author_email
  FROM public.activities a
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  WHERE (
    -- Direct entity reference
    (a.entity_id = p_candidate_id AND a.entity_type = 'candidate')
    -- Or candidate_id in metadata
    OR (a.metadata->>'candidate_id')::UUID = p_candidate_id
  )
  -- Optional job filter
  AND (
    p_job_id IS NULL 
    OR (a.metadata->>'job_id')::UUID = p_job_id
  )
  ORDER BY a.created_at DESC;
END;
$function$;

-- Backfill organization_id for existing public applicants who have NULL
UPDATE public.candidates c
SET organization_id = j.organization_id
FROM public.job_candidate_associations jca
JOIN public.jobs j ON j.id = jca.job_id
WHERE jca.candidate_id = c.id
  AND c.organization_id IS NULL;
