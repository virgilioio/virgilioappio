-- ============================================================================
-- FIX: Add RLS bypass to get_user_type_secure() to prevent recursion
-- ============================================================================
-- The function queries the members table which has RLS enabled. Even though
-- the function is SECURITY DEFINER, it needs to explicitly bypass RLS when
-- querying members to prevent evaluation issues and potential recursion.
--
-- This follows the same pattern as user_is_workspace_owner_in_tenant,
-- user_has_active_tenant_membership, and user_can_manage_org_members.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_type_secure()
RETURNS text
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
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
  
  -- Bypass RLS to query members table (prevents recursion)
  SET LOCAL row_security = off;
  
  -- Query database for actual user type
  SELECT COALESCE(user_type::text, 'guest') INTO user_type_result
  FROM public.members 
  WHERE user_id = current_user_id 
  AND user_status = 'active'
  LIMIT 1;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$function$;

COMMENT ON FUNCTION public.get_user_type_secure() IS
'Returns the user type for the current authenticated user. Marked as VOLATILE because it depends on auth.uid(). Uses SET LOCAL row_security = off to safely bypass RLS when querying members table, preventing recursion. Used by RLS policies throughout the system.';