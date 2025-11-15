-- Drop existing INSERT policy with recursive RLS issue
DROP POLICY IF EXISTS "organizations_insert_consolidated" ON public.organizations;

-- Create new INSERT policy without recursive RLS calls
CREATE POLICY "organizations_insert_consolidated" ON public.organizations
FOR INSERT
WITH CHECK (
  -- Platform admins can create any org
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND m.user_type = 'platform_admin'
  )
  OR
  -- Workspace owners can create child orgs under their tenant
  (
    parent_organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.user_status = 'active'
        AND m.user_type = 'workspace_owner'
        -- Direct comparison - no SECURITY DEFINER function call
        AND m.tenant_id = organizations.tenant_id
    )
  )
);