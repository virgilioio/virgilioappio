-- Fix validate_org_creation_permissions to use schema-qualified function calls
CREATE OR REPLACE FUNCTION public.validate_org_creation_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Allow service role (bypasses trigger check for privileged operations like signup)
  IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  -- Platform admins can create any org
  IF public.get_user_type_secure() = 'platform_admin' THEN
    RETURN NEW;
  END IF;
  
  -- Workspace owners can only create child orgs under their parent
  IF NEW.parent_organization_id IS NOT NULL THEN
    IF NOT public.user_is_workspace_owner(NEW.parent_organization_id) THEN
      RAISE EXCEPTION 'Only workspace owners can create child organizations';
    END IF;
  ELSE
    -- Only platform admins can create parent orgs (unless service role)
    RAISE EXCEPTION 'Only platform admins can create parent organizations';
  END IF;
  
  RETURN NEW;
END;
$$;