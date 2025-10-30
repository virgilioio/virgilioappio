
-- Fix check_org_member_access function to use explicit schema qualifier
-- This prevents "type member_role does not exist" errors during INSERT operations

CREATE OR REPLACE FUNCTION public.check_org_member_access(
  _organization_id uuid, 
  _required_role public.member_role DEFAULT NULL::public.member_role
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_org_id uuid;
  user_role public.member_role;
  user_is_platform_admin boolean;
BEGIN
  -- Check if user is platform admin first
  SELECT 
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin', false)
  INTO user_is_platform_admin;

  -- Platform admins bypass all org checks
  IF user_is_platform_admin THEN
    RETURN true;
  END IF;

  -- Get user's organization and role
  SELECT m.organization_id, m.member_role::public.member_role
  INTO user_org_id, user_role
  FROM public.members m
  WHERE m.user_id = auth.uid()
    AND m.user_status = 'active'
  LIMIT 1;

  -- Check if user belongs to the organization
  IF user_org_id IS NULL OR user_org_id != _organization_id THEN
    RETURN false;
  END IF;

  -- If no specific role required, just being in the org is enough
  IF _required_role IS NULL THEN
    RETURN true;
  END IF;

  -- Check if user has the required role
  RETURN user_role = _required_role;
END;
$function$;

COMMENT ON FUNCTION public.check_org_member_access IS 'Checks if the current user has access to an organization with optional role requirement. Uses explicit public.member_role schema qualifier to prevent type resolution errors.';
