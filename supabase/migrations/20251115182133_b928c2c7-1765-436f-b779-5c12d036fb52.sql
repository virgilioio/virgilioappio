-- Fix organizations RLS policy by removing SECURITY DEFINER function
-- and checking workspace owner status directly in the policy

-- Drop the existing policy
DROP POLICY IF EXISTS "organizations_insert_consolidated" ON public.organizations;

-- Create new policy with direct workspace owner check
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
        AND m.tenant_id = (
          SELECT tenant_id 
          FROM public.organizations 
          WHERE id = parent_organization_id
        )
    )
  )
);