-- Part 1: Create temporary bypass functions and update all policies
-- This fixes the infinite recursion in members RLS policies

-- ============================================================================
-- STEP 1: Create Temporary Bypass Functions (Safe Fallback)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin_safe()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  result boolean;
BEGIN
  SET LOCAL row_security = off;
  
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND m.user_type = 'platform_admin'
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$fn$;

COMMENT ON FUNCTION public.is_platform_admin_safe()
IS 'RLS-safe platform admin check (temporary). SECURITY DEFINER with scoped row_security=off.';

CREATE OR REPLACE FUNCTION public.user_is_workspace_owner_safe(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  result boolean;
  check_tenant_id uuid;
BEGIN
  SET LOCAL row_security = off;
  
  -- Get tenant_id from organization_id (handles both parent and child orgs)
  SELECT COALESCE(o.tenant_id, o.id) INTO check_tenant_id
  FROM public.organizations o
  WHERE o.id = p_org_id;
  
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
      AND m.tenant_id = check_tenant_id
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$fn$;

COMMENT ON FUNCTION public.user_is_workspace_owner_safe(uuid)
IS 'RLS-safe workspace owner check (temporary). SECURITY DEFINER with scoped row_security=off. Resolves tenant_id from org_id.';

GRANT EXECUTE ON FUNCTION public.is_platform_admin_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_workspace_owner_safe(uuid) TO authenticated;

-- ============================================================================
-- STEP 2: Update All Policies to Use Safe Functions
-- ============================================================================

-- Tenants
DROP POLICY IF EXISTS tenants_platform_admin_all ON public.tenants;
CREATE POLICY tenants_platform_admin_all ON public.tenants
FOR ALL TO public
USING (is_platform_admin_safe())
WITH CHECK (is_platform_admin_safe());

-- Invitations
DROP POLICY IF EXISTS invitations_platform_admin ON public.invitations;
CREATE POLICY invitations_platform_admin ON public.invitations
FOR ALL TO authenticated
USING (is_platform_admin_safe())
WITH CHECK (is_platform_admin_safe());

-- Audit Logs
DROP POLICY IF EXISTS audit_logs_platform_admin_select ON public.audit_logs;
CREATE POLICY audit_logs_platform_admin_select ON public.audit_logs
FOR SELECT TO authenticated
USING (is_platform_admin_safe());

-- Candidates
DROP POLICY IF EXISTS candidates_delete_consolidated ON public.candidates;
CREATE POLICY candidates_delete_consolidated ON public.candidates
FOR DELETE TO authenticated
USING (
  is_platform_admin_safe()
  OR EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = candidates.tenant_id
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  )
);

-- Job Stage Scorecards
DROP POLICY IF EXISTS scorecards_update_24h_window ON public.job_stage_scorecards;
CREATE POLICY scorecards_update_24h_window ON public.job_stage_scorecards
FOR UPDATE TO public
USING (
  (created_by = auth.uid() AND created_at > now() - interval '24 hours')
  OR is_platform_admin_safe()
)
WITH CHECK (
  (created_by = auth.uid() AND created_at > now() - interval '24 hours')
  OR is_platform_admin_safe()
);

-- Jobs
DROP POLICY IF EXISTS jobs_delete_consolidated ON public.jobs;
CREATE POLICY jobs_delete_consolidated ON public.jobs
FOR DELETE TO authenticated
USING (user_is_workspace_owner_safe(organization_id));

-- Members (THE CRITICAL ONES - these were causing recursion)
DROP POLICY IF EXISTS members_select_consolidated ON public.members;
CREATE POLICY members_select_consolidated ON public.members
FOR SELECT TO public
USING (
  is_platform_admin_safe()
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = members.tenant_id
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  )
);

DROP POLICY IF EXISTS members_insert_consolidated ON public.members;
CREATE POLICY members_insert_consolidated ON public.members
FOR INSERT TO public
WITH CHECK (
  is_platform_admin_safe()
  OR EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = (
        SELECT tenant_id FROM organizations WHERE id = members.organization_id
      )
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  )
);

DROP POLICY IF EXISTS members_update_consolidated ON public.members;
CREATE POLICY members_update_consolidated ON public.members
FOR UPDATE TO public
USING (
  is_platform_admin_safe()
  OR EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = members.tenant_id
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  )
  OR user_id = auth.uid()
)
WITH CHECK (
  is_platform_admin_safe()
  OR EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = members.tenant_id
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  )
);

-- Organizations
DROP POLICY IF EXISTS organizations_insert_consolidated ON public.organizations;
CREATE POLICY organizations_insert_consolidated ON public.organizations
FOR INSERT TO public
WITH CHECK (
  (get_user_type_secure() = 'platform_admin')
  OR user_is_workspace_owner_safe(parent_organization_id)
);

DROP POLICY IF EXISTS organizations_update_consolidated ON public.organizations;
CREATE POLICY organizations_update_consolidated ON public.organizations
FOR UPDATE TO public
USING (
  (get_user_type_secure() = 'platform_admin' 
   AND id IN (SELECT id FROM get_org_hierarchy(get_platform_tenant_id())))
  OR (user_is_workspace_owner_safe(id) AND user_has_org_hierarchy_access(id))
)
WITH CHECK (
  (get_user_type_secure() = 'platform_admin'
   AND id IN (SELECT id FROM get_org_hierarchy(get_platform_tenant_id())))
  OR (user_is_workspace_owner_safe(id) AND user_has_org_hierarchy_access(id))
);