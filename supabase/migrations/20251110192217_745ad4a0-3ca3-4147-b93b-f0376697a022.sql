-- Fix helper functions volatility issue
-- These functions use SET LOCAL row_security = off which requires VOLATILE, not STABLE

-- Drop and recreate user_is_workspace_owner_in_tenant as VOLATILE
CREATE OR REPLACE FUNCTION public.user_is_workspace_owner_in_tenant(tenant_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE  -- Changed from STABLE to VOLATILE to allow SET LOCAL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id uuid;
  is_owner boolean;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Bypass RLS to check membership
  SET LOCAL row_security = off;
  
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = current_user_id
      AND m.tenant_id = tenant_id_param
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  ) INTO is_owner;
  
  SET LOCAL row_security = on;
  
  RETURN is_owner;
END;
$$;

-- Drop and recreate user_has_active_tenant_membership as VOLATILE
CREATE OR REPLACE FUNCTION public.user_has_active_tenant_membership(tenant_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE  -- Changed from STABLE to VOLATILE to allow SET LOCAL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id uuid;
  has_membership boolean;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Bypass RLS to check membership
  SET LOCAL row_security = off;
  
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = current_user_id
      AND m.tenant_id = tenant_id_param
      AND m.user_status = 'active'
  ) INTO has_membership;
  
  SET LOCAL row_security = on;
  
  RETURN has_membership;
END;
$$;

-- Drop and recreate user_can_manage_org_members as VOLATILE
CREATE OR REPLACE FUNCTION public.user_can_manage_org_members(org_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE  -- Changed from STABLE to VOLATILE to allow SET LOCAL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id uuid;
  org_tenant_id uuid;
  can_manage boolean;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get the tenant_id for the target organization
  SELECT tenant_id INTO org_tenant_id
  FROM public.organizations
  WHERE id = org_id_param;
  
  IF org_tenant_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Bypass RLS to check if user is workspace owner in that tenant
  SET LOCAL row_security = off;
  
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = current_user_id
      AND m.tenant_id = org_tenant_id
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  ) INTO can_manage;
  
  SET LOCAL row_security = on;
  
  RETURN can_manage;
END;
$$;