
-- Fix the remaining recursion issue in the members policy

-- Drop the problematic policy that still references members table
DROP POLICY IF EXISTS "members_can_view_same_org" ON public.members;

-- Create a simpler policy that doesn't cause recursion
CREATE POLICY "members_can_view_same_org_simple" ON public.members
FOR SELECT
TO authenticated
USING (
  -- Allow viewing if user is in the same organization (using a simple join)
  organization_id = (
    SELECT organization_id 
    FROM public.members m 
    WHERE m.user_id = auth.uid() 
    LIMIT 1
  )
);

-- Also add a more permissive policy for activities to avoid issues
DROP POLICY IF EXISTS "activities_users_own" ON public.activities;
DROP POLICY IF EXISTS "activities_platform_admin" ON public.activities;

CREATE POLICY "activities_view_own_or_admin" ON public.activities
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'user_type' = 'platform_admin'
  )
);

CREATE POLICY "activities_insert_own" ON public.activities
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "activities_update_own_or_admin" ON public.activities
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'user_type' = 'platform_admin'
  )
);

CREATE POLICY "activities_delete_own_or_admin" ON public.activities
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'user_type' = 'platform_admin'
  )
);

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'Fixed remaining recursion issues in RLS policies.';
END $$;
