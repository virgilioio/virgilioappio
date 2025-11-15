-- Fix get_candidate_activities with better error logging and debug info
CREATE OR REPLACE FUNCTION public.get_candidate_activities(
  p_candidate_id UUID,
  p_job_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  organization_id UUID,
  activity_type activity_type,
  title TEXT,
  description TEXT,
  metadata JSONB,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
  
  -- Check if candidate exists
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Candidate not found or has no organization: %', p_candidate_id;
  END IF;
  
  -- Get user type and access permissions
  v_user_type := public.get_user_type_secure();
  v_has_access := public.check_org_member_access(v_org_id);
  
  -- Check if user has access to this organization
  IF NOT (v_user_type = 'platform_admin' OR v_has_access) THEN
    RAISE EXCEPTION 'Access denied to candidate activities. User: %, Candidate Org: %, User Type: %, Has Access: %', 
      v_current_user, v_org_id, v_user_type, v_has_access;
  END IF;
  
  -- Return activities related to this candidate
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
    a.created_at
  FROM public.activities a
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