-- Create helper function to get org tenant_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_org_tenant_id(org_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.organizations WHERE id = $1;
$$;

-- Drop the existing policy
DROP POLICY IF EXISTS "organizations_insert_consolidated" ON public.organizations;

-- Create new policy using the helper function to avoid recursion
CREATE POLICY "organizations_insert_consolidated" ON public.organizations
FOR INSERT
TO public
WITH CHECK (
  -- Platform admins can insert any organization
  (public.get_user_type_secure() = 'platform_admin')
  OR
  -- Workspace owners can insert child orgs under their tenant
  (
    parent_organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.user_status = 'active'
        AND m.user_type = 'workspace_owner'
        AND m.tenant_id = public.get_org_tenant_id(parent_organization_id)
    )
  )
);