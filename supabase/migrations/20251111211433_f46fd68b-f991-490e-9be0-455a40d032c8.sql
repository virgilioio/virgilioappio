-- ============================================================================
-- FIX: Change get_user_type_secure() from STABLE to VOLATILE
-- ============================================================================
-- The function was marked STABLE but accesses auth.uid() which can change
-- between calls in different authentication contexts. This caused RLS policy
-- evaluation failures for platform_assets INSERT operations from edge functions.
-- 
-- Reference: Similar to the fix applied to user_is_workspace_owner_in_tenant,
-- user_has_active_tenant_membership, and user_can_manage_org_members.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_type_secure()
RETURNS text
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER  -- Changed from STABLE to VOLATILE
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

COMMENT ON FUNCTION public.get_user_type_secure() IS
'Returns the user type for the current authenticated user. Marked as VOLATILE because it depends on auth.uid() which changes with authentication context. Used by RLS policies throughout the system.';