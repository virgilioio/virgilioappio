-- Phase 1: Fix Sourcing Projects Tenant Isolation - RLS Policies

-- Drop the problematic blanket platform admin access policy
DROP POLICY IF EXISTS "Platform admins full access" ON public.sourcing_projects;

-- Drop old policies to recreate them with tenant isolation
DROP POLICY IF EXISTS "Users can view own or public org projects" ON public.sourcing_projects;
DROP POLICY IF EXISTS "Authorized users can update projects" ON public.sourcing_projects;

-- CREATE: Tenant-scoped SELECT policy
CREATE POLICY "Users can view tenant-scoped sourcing projects"
ON public.sourcing_projects
FOR SELECT
TO public
USING (
  -- Must be in the same tenant hierarchy
  user_has_org_hierarchy_access(organization_id)
  AND (
    -- Either created by the user
    created_by = auth.uid()
    -- Or is a public project within their tenant
    OR is_public = true
  )
);

-- CREATE: Tenant-scoped UPDATE policy
CREATE POLICY "Users can update tenant-scoped sourcing projects"
ON public.sourcing_projects
FOR UPDATE
TO public
USING (
  user_has_org_hierarchy_access(organization_id)
  AND check_org_hierarchy_role_access(organization_id, 'recruiter'::text)
  AND (
    created_by = auth.uid()
    OR is_public = true
  )
)
WITH CHECK (
  user_has_org_hierarchy_access(organization_id)
  AND check_org_hierarchy_role_access(organization_id, 'recruiter'::text)
);

-- CREATE: Tenant-scoped INSERT policy
CREATE POLICY "Users can create sourcing projects in their tenant"
ON public.sourcing_projects
FOR INSERT
TO public
WITH CHECK (
  user_has_org_hierarchy_access(organization_id)
  AND check_org_hierarchy_role_access(organization_id, 'recruiter'::text)
);

-- CREATE: Tenant-scoped DELETE policy (workspace owners + project creators)
CREATE POLICY "Users can delete their own sourcing projects"
ON public.sourcing_projects
FOR DELETE
TO public
USING (
  user_has_org_hierarchy_access(organization_id)
  AND (
    created_by = auth.uid()
    OR user_is_workspace_owner_in_tenant((
      SELECT tenant_id FROM organizations WHERE id = organization_id
    ))
  )
);