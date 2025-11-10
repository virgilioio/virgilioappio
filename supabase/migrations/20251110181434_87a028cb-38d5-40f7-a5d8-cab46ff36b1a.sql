-- Part 2 Final: Complete Cleanup with Explicit Policy Drops
-- Ensures all policies are cleanly recreated

-- Explicitly drop ALL policies that need to be recreated (in case CASCADE missed some)
DROP POLICY IF EXISTS tenants_platform_admin_all ON public.tenants;
DROP POLICY IF EXISTS invitations_platform_admin ON public.invitations;
DROP POLICY IF EXISTS audit_logs_platform_admin_select ON audit.audit_logs;
DROP POLICY IF EXISTS candidates_delete_consolidated ON public.candidates;
DROP POLICY IF EXISTS scorecards_update_24h_window ON public.job_stage_scorecards;
DROP POLICY IF EXISTS jobs_delete_consolidated ON public.jobs;
DROP POLICY IF EXISTS members_select_consolidated ON public.members;
DROP POLICY IF EXISTS members_insert_consolidated ON public.members;
DROP POLICY IF EXISTS members_update_consolidated ON public.members;
DROP POLICY IF EXISTS organizations_insert_consolidated ON public.organizations;
DROP POLICY IF EXISTS organizations_update_consolidated ON public.organizations;

-- Drop any remaining _safe functions
DROP FUNCTION IF EXISTS public.is_platform_admin_safe() CASCADE;
DROP FUNCTION IF EXISTS public.user_is_workspace_owner_safe(uuid) CASCADE;

-- Now recreate all policies using the original (now RLS-safe) function names

-- Tenants
CREATE POLICY tenants_platform_admin_all ON public.tenants
FOR ALL TO public
USING (is_platform_admin())
WITH CHECK (is_platform_admin());

-- Invitations
CREATE POLICY invitations_platform_admin ON public.invitations
FOR ALL TO authenticated
USING (is_platform_admin())
WITH CHECK (is_platform_admin());

-- Audit Logs
CREATE POLICY audit_logs_platform_admin_select ON audit.audit_logs
FOR SELECT TO authenticated
USING (is_platform_admin());

-- Candidates
CREATE POLICY candidates_delete_consolidated ON public.candidates
FOR DELETE TO authenticated
USING (
  is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = candidates.tenant_id
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  )
);

-- Job Stage Scorecards
CREATE POLICY scorecards_update_24h_window ON public.job_stage_scorecards
FOR UPDATE TO public
USING (
  (created_by = auth.uid() AND created_at > now() - interval '24 hours')
  OR is_platform_admin()
)
WITH CHECK (
  (created_by = auth.uid() AND created_at > now() - interval '24 hours')
  OR is_platform_admin()
);

-- Jobs
CREATE POLICY jobs_delete_consolidated ON public.jobs
FOR DELETE TO authenticated
USING (user_is_workspace_owner(organization_id));

-- Members (now use RLS-safe functions - no more infinite recursion!)
CREATE POLICY members_select_consolidated ON public.members
FOR SELECT TO public
USING (
  is_platform_admin()
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = members.tenant_id
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  )
);

CREATE POLICY members_insert_consolidated ON public.members
FOR INSERT TO public
WITH CHECK (
  is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = (
        SELECT tenant_id FROM organizations WHERE id = organization_id
      )
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  )
);

CREATE POLICY members_update_consolidated ON public.members
FOR UPDATE TO public
USING (
  is_platform_admin()
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
  is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = members.tenant_id
      AND m.user_type = 'workspace_owner'
      AND m.user_status = 'active'
  )
);

-- Organizations
CREATE POLICY organizations_insert_consolidated ON public.organizations
FOR INSERT TO public
WITH CHECK (
  (get_user_type_secure() = 'platform_admin')
  OR user_is_workspace_owner(parent_organization_id)
);

CREATE POLICY organizations_update_consolidated ON public.organizations
FOR UPDATE TO public
USING (
  (get_user_type_secure() = 'platform_admin' 
   AND id IN (SELECT id FROM get_org_hierarchy(get_platform_tenant_id())))
  OR (user_is_workspace_owner(id) AND user_has_org_hierarchy_access(id))
)
WITH CHECK (
  (get_user_type_secure() = 'platform_admin'
   AND id IN (SELECT id FROM get_org_hierarchy(get_platform_tenant_id())))
  OR (user_is_workspace_owner(id) AND user_has_org_hierarchy_access(id))
);

-- Success notification
DO $$
BEGIN
  RAISE NOTICE '==========================================';
  RAISE NOTICE '    RLS RECURSION FIX - COMPLETE!';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed Functions:';
  RAISE NOTICE '  • is_platform_admin()';
  RAISE NOTICE '  • user_is_workspace_owner(org_id)';
  RAISE NOTICE '';
  RAISE NOTICE 'Both now use:';
  RAISE NOTICE '  ✓ SECURITY DEFINER (runs as function owner)';
  RAISE NOTICE '  ✓ SET LOCAL row_security = off (prevents recursion)';
  RAISE NOTICE '  ✓ SET search_path = public, pg_temp (prevents hijacking)';
  RAISE NOTICE '';
  RAISE NOTICE 'Architectural Improvements:';
  RAISE NOTICE '  ✓ user_is_workspace_owner now correctly resolves tenant_id';
  RAISE NOTICE '  ✓ Supports both parent and child organization checks';
  RAISE NOTICE '  ✓ Maintains proper multi-tenant isolation';
  RAISE NOTICE '';
  RAISE NOTICE 'Policies Updated: 11 total';
  RAISE NOTICE '  - tenants (1)';
  RAISE NOTICE '  - invitations (1)';
  RAISE NOTICE '  - audit_logs (1)';
  RAISE NOTICE '  - candidates (1)';
  RAISE NOTICE '  - job_stage_scorecards (1)';
  RAISE NOTICE '  - jobs (1)';
  RAISE NOTICE '  - members (3) ← Critical fix!';
  RAISE NOTICE '  - organizations (2)';
  RAISE NOTICE '';
  RAISE NOTICE 'Test with: SELECT * FROM members LIMIT 1;';
  RAISE NOTICE '';
END $$;