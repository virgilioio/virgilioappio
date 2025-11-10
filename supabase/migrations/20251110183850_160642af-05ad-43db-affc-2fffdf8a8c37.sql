-- =====================================================
-- Complete RLS Recursion Fix
-- Creates helper functions and rewrites all policies that query members table
-- =====================================================

-- =====================================================
-- PHASE 1: Create RLS-Safe Helper Functions
-- =====================================================

-- Helper 1: Check if user is workspace owner in specific tenant
CREATE OR REPLACE FUNCTION public.user_is_workspace_owner_in_tenant(tenant_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result boolean;
BEGIN
  SET LOCAL row_security = off;
  
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = tenant_id_param
    AND m.user_status = 'active'
    AND m.user_type = 'workspace_owner'
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

COMMENT ON FUNCTION public.user_is_workspace_owner_in_tenant(uuid) IS 
'RLS-safe function to check if current user is workspace owner in specified tenant. Bypasses RLS internally to prevent recursion.';

-- Helper 2: Check if user has any active membership in tenant
CREATE OR REPLACE FUNCTION public.user_has_active_tenant_membership(tenant_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result boolean;
BEGIN
  SET LOCAL row_security = off;
  
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = tenant_id_param
    AND m.user_status = 'active'
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

COMMENT ON FUNCTION public.user_has_active_tenant_membership(uuid) IS 
'RLS-safe function to check if current user has any active membership in specified tenant. Bypasses RLS internally to prevent recursion.';

-- Helper 3: Check if user can manage members in an organization
CREATE OR REPLACE FUNCTION public.user_can_manage_org_members(org_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result boolean;
  org_tenant_id uuid;
BEGIN
  SET LOCAL row_security = off;
  
  -- Get tenant_id from organization
  SELECT tenant_id INTO org_tenant_id
  FROM public.organizations
  WHERE id = org_id_param;
  
  IF org_tenant_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user is platform admin or workspace owner in that tenant
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
    AND m.tenant_id = org_tenant_id
    AND m.user_status = 'active'
    AND m.user_type IN ('platform_admin', 'workspace_owner')
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

COMMENT ON FUNCTION public.user_can_manage_org_members(uuid) IS 
'RLS-safe function to check if current user can manage members in specified organization. Bypasses RLS internally to prevent recursion.';

-- =====================================================
-- PHASE 2: Rewrite Members Table RLS Policies
-- =====================================================

-- Drop existing members policies
DROP POLICY IF EXISTS members_select_consolidated ON public.members;
DROP POLICY IF EXISTS members_insert_consolidated ON public.members;
DROP POLICY IF EXISTS members_update_consolidated ON public.members;

-- Recreate SELECT policy with helper function
CREATE POLICY members_select_consolidated ON public.members
FOR SELECT
USING (
  -- Platform admins see all members
  public.is_platform_admin()
  OR
  -- Workspace owners see all members in their tenant
  public.user_is_workspace_owner_in_tenant(tenant_id)
  OR
  -- Users see members in their own tenant
  public.user_has_active_tenant_membership(tenant_id)
);

-- Recreate INSERT policy with helper function
CREATE POLICY members_insert_consolidated ON public.members
FOR INSERT
WITH CHECK (
  -- Platform admins and workspace owners can invite members
  public.user_can_manage_org_members(organization_id)
);

-- Recreate UPDATE policy with helper function
CREATE POLICY members_update_consolidated ON public.members
FOR UPDATE
USING (
  -- Platform admins can update all
  public.is_platform_admin()
  OR
  -- Workspace owners can update members in their tenant
  public.user_is_workspace_owner_in_tenant(tenant_id)
  OR
  -- Users can update their own member record
  user_id = auth.uid()
)
WITH CHECK (
  -- Platform admins can update all
  public.is_platform_admin()
  OR
  -- Workspace owners can update members in their tenant
  public.user_is_workspace_owner_in_tenant(tenant_id)
  OR
  -- Users can update their own member record
  user_id = auth.uid()
);

-- =====================================================
-- PHASE 3: Fix Other Tables' Policies
-- =====================================================

-- Fix candidates DELETE policy
DROP POLICY IF EXISTS candidates_delete_consolidated ON public.candidates;

CREATE POLICY candidates_delete_consolidated ON public.candidates
FOR DELETE
USING (
  -- Only platform admins and workspace owners can delete candidates
  public.is_platform_admin()
  OR
  public.user_is_workspace_owner_in_tenant(tenant_id)
);

-- =====================================================
-- PHASE 4: Set Permissions
-- =====================================================

-- Set ownership to postgres for SECURITY DEFINER functions
ALTER FUNCTION public.user_is_workspace_owner_in_tenant(uuid) OWNER TO postgres;
ALTER FUNCTION public.user_has_active_tenant_membership(uuid) OWNER TO postgres;
ALTER FUNCTION public.user_can_manage_org_members(uuid) OWNER TO postgres;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.user_is_workspace_owner_in_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_active_tenant_membership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_org_members(uuid) TO authenticated;

-- =====================================================
-- Verification
-- =====================================================
-- After migration, test with: SELECT * FROM members LIMIT 1;