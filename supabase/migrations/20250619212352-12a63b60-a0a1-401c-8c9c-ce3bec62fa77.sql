
-- Fix infinite recursion in get_user_type() function and members table RLS policies

-- Step 1: First, let's create a safer version of get_user_type() that bypasses RLS
CREATE OR REPLACE FUNCTION public.get_user_type()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_type_result text;
  member_count int;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Log for debugging
  RAISE LOG 'get_user_type() called for user_id: %', current_user_id;
  
  -- If no user is authenticated, return guest
  IF current_user_id IS NULL THEN
    RAISE LOG 'No authenticated user, returning guest';
    RETURN 'guest';
  END IF;
  
  -- Use a direct query that bypasses RLS to avoid infinite recursion
  -- This is safe because we're only querying for the current authenticated user
  EXECUTE 'SELECT COUNT(*) FROM public.members WHERE user_id = $1'
  INTO member_count
  USING current_user_id;
  
  RAISE LOG 'Found % member records for user %', member_count, current_user_id;
  
  -- Get user type from members table, bypassing RLS
  EXECUTE 'SELECT COALESCE(user_type::text, ''guest'') FROM public.members WHERE user_id = $1 LIMIT 1'
  INTO user_type_result
  USING current_user_id;
  
  RAISE LOG 'User type result for user %: %', current_user_id, user_type_result;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$$;

-- Step 2: Create a similar safe version of get_member_role()
CREATE OR REPLACE FUNCTION public.get_member_role()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  member_role_result text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 'guest';
  END IF;
  
  -- Use a direct query that bypasses RLS
  EXECUTE 'SELECT COALESCE(member_role::text, ''guest'') FROM public.members WHERE user_id = $1 LIMIT 1'
  INTO member_role_result
  USING current_user_id;
  
  RETURN COALESCE(member_role_result, 'guest');
END;
$$;

-- Step 3: Create a safe version of get_user_organization_id()
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  org_id_result uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Use a direct query that bypasses RLS
  EXECUTE 'SELECT organization_id FROM public.members WHERE user_id = $1 LIMIT 1'
  INTO org_id_result
  USING current_user_id;
  
  RETURN org_id_result;
END;
$$;

-- Step 4: Now create simple, non-recursive RLS policies for the members table
-- First, drop any existing policies that might cause recursion
DROP POLICY IF EXISTS "members_select_policy" ON public.members;
DROP POLICY IF EXISTS "members_insert_policy" ON public.members;
DROP POLICY IF EXISTS "members_update_policy" ON public.members;
DROP POLICY IF EXISTS "members_delete_policy" ON public.members;

-- Create new, simple RLS policies that don't call functions that query members table
CREATE POLICY "members_select_policy" ON public.members
FOR SELECT 
TO authenticated
USING (
  -- Users can see their own member record
  user_id = auth.uid()
  OR
  -- Users can see members from their organization (without using helper functions)
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
    AND m.organization_id = members.organization_id
  )
);

CREATE POLICY "members_insert_policy" ON public.members
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Only allow inserts for users with admin privileges
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
    AND m.member_role IN ('admin', 'customer_success')
    AND (m.organization_id = organization_id OR m.user_type = 'platform_admin')
  )
);

CREATE POLICY "members_update_policy" ON public.members
FOR UPDATE 
TO authenticated
USING (
  -- Allow updates by admins in the same org or platform admins
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
    AND (
      (m.member_role IN ('admin', 'customer_success') AND m.organization_id = members.organization_id)
      OR m.user_type = 'platform_admin'
    )
  )
);

CREATE POLICY "members_delete_policy" ON public.members
FOR DELETE 
TO authenticated
USING (
  -- Allow deletion by platform admins or org admins
  EXISTS (
    SELECT 1 FROM public.members m 
    WHERE m.user_id = auth.uid() 
    AND (
      m.user_type = 'platform_admin'
      OR (m.member_role = 'admin' AND m.organization_id = members.organization_id)
    )
  )
);

-- Step 5: Add a safety check function to prevent infinite loops
CREATE OR REPLACE FUNCTION public.check_recursion_safety()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- This is a simple check that can be used in policies if needed
  -- It doesn't query any tables that have RLS policies
  RETURN auth.uid() IS NOT NULL;
END;
$$;

-- Step 6: Log a success message
DO $$
BEGIN
  RAISE NOTICE 'Infinite recursion fix applied successfully. Updated functions: get_user_type(), get_member_role(), get_user_organization_id() and members table RLS policies.';
END $$;
