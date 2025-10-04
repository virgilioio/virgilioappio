-- ============================================================
-- Phase 2 Cycle 1: Create Missing Permission Function
-- ============================================================
-- The sync_job_candidates_to_independent() RPC requires this function
-- but it's missing from the database schema
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_type_secure()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid;
  user_type_result text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 'guest';
  END IF;
  
  -- Check auth metadata for platform admin first
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = current_user_id 
    AND (raw_user_meta_data->>'user_type') = 'platform_admin'
  ) THEN
    RETURN 'platform_admin';
  END IF;
  
  -- Query database for actual user type
  SELECT COALESCE(user_type::text, 'guest') INTO user_type_result
  FROM public.members 
  WHERE user_id = current_user_id 
  AND user_status = 'active'
  LIMIT 1;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$function$;