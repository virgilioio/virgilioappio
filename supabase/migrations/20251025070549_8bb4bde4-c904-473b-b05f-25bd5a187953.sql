-- Fix get_candidate_activities function with proper schema prefixes
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
BEGIN
  -- Get the candidate's organization
  SELECT c.organization_id INTO v_org_id
  FROM public.candidates c
  WHERE c.id = p_candidate_id;
  
  -- Check if user has access to this organization
  -- FIXED: Add public. prefix to function calls
  IF NOT (
    public.get_user_type_secure() = 'platform_admin'
    OR public.check_org_member_access(v_org_id)
  ) THEN
    RAISE EXCEPTION 'Access denied to candidate activities';
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