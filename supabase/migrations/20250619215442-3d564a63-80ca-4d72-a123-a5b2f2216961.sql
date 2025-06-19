
-- Drop the remaining problematic policy that's still querying auth.users directly
DROP POLICY IF EXISTS "organizations_workspace_owner" ON public.organizations;

-- Also drop any other potentially problematic policies we might have missed
DROP POLICY IF EXISTS "Organizations select policy" ON public.organizations;
DROP POLICY IF EXISTS "Organizations insert policy" ON public.organizations;
DROP POLICY IF EXISTS "Organizations update policy" ON public.organizations;
DROP POLICY IF EXISTS "Organizations delete policy" ON public.organizations;

-- Create a comprehensive set of clean policies using only get_user_type()
-- Platform admins can do everything
CREATE POLICY "organizations_platform_admin_all" ON public.organizations
FOR ALL
TO authenticated
USING (get_user_type() = 'platform_admin');

-- Workspace owners can view and update their own organization
CREATE POLICY "organizations_workspace_owner_access" ON public.organizations
FOR SELECT
TO authenticated
USING (
  get_user_type() = 'workspace_owner' 
  AND owner_id = auth.uid()
);

CREATE POLICY "organizations_workspace_owner_update" ON public.organizations
FOR UPDATE
TO authenticated
USING (
  get_user_type() = 'workspace_owner' 
  AND owner_id = auth.uid()
);

-- Customer success can view and manage organizations
CREATE POLICY "organizations_customer_success_access" ON public.organizations
FOR ALL
TO authenticated
USING (get_member_role() = 'customer_success');
