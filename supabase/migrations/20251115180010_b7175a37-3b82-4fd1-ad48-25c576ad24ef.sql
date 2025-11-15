-- Fix user_is_workspace_owner to bypass RLS for all queries
CREATE OR REPLACE FUNCTION public.user_is_workspace_owner(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  current_user_id uuid;
  is_owner boolean;
  org_tenant_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  IF org_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Bypass RLS for all queries in this function
  SET LOCAL row_security = off;
  
  -- Get the tenant_id for the organization
  SELECT tenant_id INTO org_tenant_id
  FROM public.organizations
  WHERE id = org_id;
  
  IF org_tenant_id IS NULL THEN
    SET LOCAL row_security = on;
    RETURN false;
  END IF;
  
  -- Check membership
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = current_user_id
      AND m.tenant_id = org_tenant_id
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  ) INTO is_owner;
  
  SET LOCAL row_security = on;
  
  RETURN COALESCE(is_owner, false);
END;
$$;