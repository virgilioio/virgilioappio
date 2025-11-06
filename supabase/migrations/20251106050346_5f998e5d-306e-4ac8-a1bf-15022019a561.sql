-- ============================================================
-- PHASE 4: Consolidate RLS Policies & Remove Hardcoded UUIDs
-- Simplifies policy management and removes hardcoded Virgilio UUID
-- ============================================================

-- 1. Create function to get platform tenant ID dynamically
CREATE OR REPLACE FUNCTION public.get_platform_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT id 
  FROM public.organizations 
  WHERE organization_type = 'platform' 
    AND tenant_type = 'saas'
    AND name = 'Virgilio'
  LIMIT 1
$$;

COMMENT ON FUNCTION public.get_platform_tenant_id IS 
'Returns the Virgilio platform organization ID dynamically (replaces hardcoded UUID).';

-- ============================================================
-- CONSOLIDATE job_hiring_stages POLICIES (9 policies → 4 policies)
-- ============================================================

-- Drop all existing job_hiring_stages policies
DROP POLICY IF EXISTS "Users can view hiring stages for jobs they can access" ON public.job_hiring_stages;
DROP POLICY IF EXISTS "Users can view job hiring stages for accessible jobs" ON public.job_hiring_stages;
DROP POLICY IF EXISTS "View job hiring stages - org member or assigned" ON public.job_hiring_stages;
DROP POLICY IF EXISTS job_hiring_stages_org_member_delete ON public.job_hiring_stages;
DROP POLICY IF EXISTS job_hiring_stages_org_member_insert ON public.job_hiring_stages;
DROP POLICY IF EXISTS job_hiring_stages_org_member_update ON public.job_hiring_stages;
DROP POLICY IF EXISTS job_hiring_stages_platform_admin_delete ON public.job_hiring_stages;
DROP POLICY IF EXISTS job_hiring_stages_platform_admin_insert ON public.job_hiring_stages;
DROP POLICY IF EXISTS job_hiring_stages_platform_admin_update ON public.job_hiring_stages;

-- Create 4 consolidated policies for job_hiring_stages
CREATE POLICY job_hiring_stages_select_consolidated ON public.job_hiring_stages
FOR SELECT
USING (
  -- Platform admins can view all hiring stages in their tenant
  (get_user_type_secure() = 'platform_admin' AND 
   EXISTS (
     SELECT 1 FROM public.jobs j 
     WHERE j.id = job_hiring_stages.job_id 
     AND j.organization_id IN (
       SELECT id FROM public.get_org_hierarchy(public.get_platform_tenant_id())
     )
   ))
  OR
  -- Users can view hiring stages for jobs in their org hierarchy
  user_has_org_hierarchy_access((SELECT organization_id FROM public.jobs WHERE id = job_hiring_stages.job_id))
  OR
  -- Users can view hiring stages for jobs they're assigned to
  is_user_assigned_to_job(job_id)
);

CREATE POLICY job_hiring_stages_insert_consolidated ON public.job_hiring_stages
FOR INSERT
WITH CHECK (
  -- Platform admins can insert hiring stages in their tenant
  (get_user_type_secure() = 'platform_admin' AND 
   EXISTS (
     SELECT 1 FROM public.jobs j 
     WHERE j.id = job_hiring_stages.job_id 
     AND j.organization_id IN (
       SELECT id FROM public.get_org_hierarchy(public.get_platform_tenant_id())
     )
   ))
  OR
  -- Recruiters can insert hiring stages for jobs in their hierarchy
  check_org_hierarchy_role_access((SELECT organization_id FROM public.jobs WHERE id = job_hiring_stages.job_id), 'recruiter')
);

CREATE POLICY job_hiring_stages_update_consolidated ON public.job_hiring_stages
FOR UPDATE
USING (
  -- Platform admins can update hiring stages in their tenant
  (get_user_type_secure() = 'platform_admin' AND 
   EXISTS (
     SELECT 1 FROM public.jobs j 
     WHERE j.id = job_hiring_stages.job_id 
     AND j.organization_id IN (
       SELECT id FROM public.get_org_hierarchy(public.get_platform_tenant_id())
     )
   ))
  OR
  -- Recruiters can update hiring stages for jobs in their hierarchy
  check_org_hierarchy_role_access((SELECT organization_id FROM public.jobs WHERE id = job_hiring_stages.job_id), 'recruiter')
)
WITH CHECK (
  -- Same rules for WITH CHECK
  (get_user_type_secure() = 'platform_admin' AND 
   EXISTS (
     SELECT 1 FROM public.jobs j 
     WHERE j.id = job_hiring_stages.job_id 
     AND j.organization_id IN (
       SELECT id FROM public.get_org_hierarchy(public.get_platform_tenant_id())
     )
   ))
  OR
  check_org_hierarchy_role_access((SELECT organization_id FROM public.jobs WHERE id = job_hiring_stages.job_id), 'recruiter')
);

CREATE POLICY job_hiring_stages_delete_consolidated ON public.job_hiring_stages
FOR DELETE
USING (
  -- Platform admins can delete hiring stages in their tenant
  (get_user_type_secure() = 'platform_admin' AND 
   EXISTS (
     SELECT 1 FROM public.jobs j 
     WHERE j.id = job_hiring_stages.job_id 
     AND j.organization_id IN (
       SELECT id FROM public.get_org_hierarchy(public.get_platform_tenant_id())
     )
   ))
  OR
  -- Admins (not recruiters) can delete hiring stages in their hierarchy
  check_org_hierarchy_role_access((SELECT organization_id FROM public.jobs WHERE id = job_hiring_stages.job_id), 'admin')
);

-- ============================================================
-- CONSOLIDATE organizations POLICIES (7 policies → 4 policies)
-- ============================================================

-- Drop all existing organizations policies
DROP POLICY IF EXISTS "Organization members can view their org exchange rates" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can view their exchange rates" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Platform admins can manage all organizations - secure" ON public.organizations;
DROP POLICY IF EXISTS "Public can view organizations with active postings - safe" ON public.organizations;
DROP POLICY IF EXISTS "Users can view organizations for assigned jobs" ON public.organizations;

-- Create 4 consolidated policies for organizations
CREATE POLICY organizations_select_consolidated ON public.organizations
FOR SELECT
USING (
  -- Platform admins can view all orgs in their tenant
  (get_user_type_secure() = 'platform_admin' AND 
   id IN (SELECT id FROM public.get_org_hierarchy(public.get_platform_tenant_id())))
  OR
  -- Users can view orgs in their hierarchy
  user_has_org_hierarchy_access(id)
  OR
  -- Users can view orgs for jobs they're assigned to
  (EXISTS (
    SELECT 1 FROM public.job_assignments ja
    JOIN public.jobs j ON ja.job_id = j.id
    WHERE ja.user_id = auth.uid() AND j.organization_id = organizations.id
  ))
  OR
  -- Public can view orgs with active postings
  organization_has_active_public_posting(id)
);

CREATE POLICY organizations_insert_consolidated ON public.organizations
FOR INSERT
WITH CHECK (
  -- Platform admins can create any org in their tenant
  get_user_type_secure() = 'platform_admin'
  OR
  -- Workspace owners can create child orgs (enforced by trigger)
  user_is_workspace_owner(parent_organization_id)
);

CREATE POLICY organizations_update_consolidated ON public.organizations
FOR UPDATE
USING (
  -- Platform admins can update orgs in their tenant
  (get_user_type_secure() = 'platform_admin' AND 
   id IN (SELECT id FROM public.get_org_hierarchy(public.get_platform_tenant_id())))
  OR
  -- Workspace owners can update their org hierarchy
  (user_is_workspace_owner(id) AND user_has_org_hierarchy_access(id))
)
WITH CHECK (
  -- Same rules for WITH CHECK
  (get_user_type_secure() = 'platform_admin' AND 
   id IN (SELECT id FROM public.get_org_hierarchy(public.get_platform_tenant_id())))
  OR
  (user_is_workspace_owner(id) AND user_has_org_hierarchy_access(id))
);

CREATE POLICY organizations_delete_consolidated ON public.organizations
FOR DELETE
USING (
  -- Only platform admins can delete orgs in their tenant
  (get_user_type_secure() = 'platform_admin' AND 
   id IN (SELECT id FROM public.get_org_hierarchy(public.get_platform_tenant_id())))
);

-- Add comments for documentation
COMMENT ON POLICY job_hiring_stages_select_consolidated ON public.job_hiring_stages IS 
'Consolidated SELECT: Platform admins (tenant scope), org hierarchy access, or assigned users';

COMMENT ON POLICY job_hiring_stages_insert_consolidated ON public.job_hiring_stages IS 
'Consolidated INSERT: Platform admins (tenant scope) or recruiters in hierarchy';

COMMENT ON POLICY job_hiring_stages_update_consolidated ON public.job_hiring_stages IS 
'Consolidated UPDATE: Platform admins (tenant scope) or recruiters in hierarchy';

COMMENT ON POLICY job_hiring_stages_delete_consolidated ON public.job_hiring_stages IS 
'Consolidated DELETE: Platform admins (tenant scope) or org admins in hierarchy';

COMMENT ON POLICY organizations_select_consolidated ON public.organizations IS 
'Consolidated SELECT: Platform admins (tenant scope), org hierarchy, job assignments, or public postings';

COMMENT ON POLICY organizations_insert_consolidated ON public.organizations IS 
'Consolidated INSERT: Platform admins or workspace owners (trigger validates further)';

COMMENT ON POLICY organizations_update_consolidated ON public.organizations IS 
'Consolidated UPDATE: Platform admins (tenant scope) or workspace owners in hierarchy';

COMMENT ON POLICY organizations_delete_consolidated ON public.organizations IS 
'Consolidated DELETE: Platform admins only (tenant scope)';