
-- Update organizations RLS policies to allow workspace owners to see their own organization
-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Organizations select policy" ON public.organizations;
DROP POLICY IF EXISTS "Organizations insert policy" ON public.organizations;
DROP POLICY IF EXISTS "Organizations update policy" ON public.organizations;
DROP POLICY IF EXISTS "Organizations delete policy" ON public.organizations;

-- Create new SELECT policy that allows workspace owners to see their organization
CREATE POLICY "Organizations select policy" ON public.organizations
FOR SELECT 
TO authenticated
USING (
  get_user_type() = 'platform_admin' 
  OR get_member_role() = 'customer_success'
  OR (
    get_user_type() = 'workspace_owner' 
    AND EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = organizations.id
    )
  )
);

-- Recreate other policies with workspace owner support
CREATE POLICY "Organizations insert policy" ON public.organizations
FOR INSERT 
TO authenticated
WITH CHECK (
  get_user_type() = 'platform_admin' 
  OR get_member_role() = 'customer_success'
);

CREATE POLICY "Organizations update policy" ON public.organizations
FOR UPDATE 
TO authenticated
USING (
  get_user_type() = 'platform_admin' 
  OR get_member_role() = 'customer_success'
  OR (
    get_user_type() = 'workspace_owner' 
    AND EXISTS (
      SELECT 1 FROM public.members m 
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = organizations.id
    )
  )
);

CREATE POLICY "Organizations delete policy" ON public.organizations
FOR DELETE 
TO authenticated
USING (get_user_type() = 'platform_admin');
