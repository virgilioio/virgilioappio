-- Drop the existing policy
DROP POLICY IF EXISTS "organizations_insert_consolidated" ON public.organizations;

-- Create new policy with direct EXISTS checks to avoid SECURITY DEFINER context issues
CREATE POLICY "organizations_insert_consolidated" ON public.organizations
FOR INSERT
TO public
WITH CHECK (
  -- Platform admins: check members table directly (no SECURITY DEFINER function call)
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND m.user_type = 'platform_admin'
  )
  OR
  -- Workspace owners: can insert child orgs under their tenant
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