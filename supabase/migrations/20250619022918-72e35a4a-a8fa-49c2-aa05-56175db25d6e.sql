
-- Create RLS policies for the organizations table to fix platform admin access issues

-- Drop any existing policies that might conflict
DROP POLICY IF EXISTS "Platform admins can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Customer success can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Workspace owners can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Only platform admins and customer success can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Platform admins and workspace owners can update organizations" ON public.organizations;
DROP POLICY IF EXISTS "Only platform admins can delete organizations" ON public.organizations;

-- SELECT Policy: Platform admins and customer success see all, workspace owners see their own
CREATE POLICY "Organizations select policy" ON public.organizations
FOR SELECT 
TO authenticated
USING (
  get_user_type() = 'platform_admin' 
  OR get_member_role() = 'customer_success'
  OR (
    get_user_type() = 'workspace_owner' 
    AND id = get_user_organization_id()
  )
);

-- INSERT Policy: Platform admins and customer success can create organizations
CREATE POLICY "Organizations insert policy" ON public.organizations
FOR INSERT 
TO authenticated
WITH CHECK (
  get_user_type() = 'platform_admin' 
  OR get_member_role() = 'customer_success'
);

-- UPDATE Policy: Platform admins, customer success, and workspace owners can update their own org
CREATE POLICY "Organizations update policy" ON public.organizations
FOR UPDATE 
TO authenticated
USING (
  get_user_type() = 'platform_admin' 
  OR get_member_role() = 'customer_success'
  OR (
    get_user_type() = 'workspace_owner' 
    AND id = get_user_organization_id()
  )
);

-- DELETE Policy: Only platform admins can delete/deactivate organizations
CREATE POLICY "Organizations delete policy" ON public.organizations
FOR DELETE 
TO authenticated
USING (get_user_type() = 'platform_admin');
