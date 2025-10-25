-- Simplify get_user_organization_id() to JWT-only resolution
-- This eliminates circular RLS dependencies by removing all database queries
-- The organization_id MUST be set in JWT metadata by set-current-organization edge function

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  jwt_org_id text;
BEGIN
  -- Only read organization_id from JWT metadata (no database queries)
  -- This is set by the set-current-organization edge function when user switches orgs
  jwt_org_id := auth.jwt() -> 'user_metadata' ->> 'organization_id';
  
  IF jwt_org_id IS NULL OR jwt_org_id = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN jwt_org_id::uuid;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$function$;