
-- Step 1: Debug the get_user_type() function by adding logging and error handling
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
  
  -- Count members for this user
  SELECT COUNT(*) INTO member_count
  FROM public.members 
  WHERE user_id = current_user_id;
  
  RAISE LOG 'Found % member records for user %', member_count, current_user_id;
  
  -- Get user type from members table
  SELECT COALESCE(m.user_type::text, 'guest') INTO user_type_result
  FROM public.members m
  WHERE m.user_id = current_user_id 
  LIMIT 1;
  
  RAISE LOG 'User type result for user %: %', current_user_id, user_type_result;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$$;

-- Step 2: Create a test function to verify user permissions
CREATE OR REPLACE FUNCTION public.debug_user_permissions()
RETURNS TABLE(
  current_user_id uuid,
  user_type text,
  member_role text,
  organization_id uuid,
  member_count bigint,
  can_see_all_orgs boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as current_user_id,
    get_user_type() as user_type,
    get_member_role() as member_role,
    get_user_organization_id() as organization_id,
    (SELECT COUNT(*) FROM public.members WHERE user_id = auth.uid()) as member_count,
    (get_user_type() = 'platform_admin') as can_see_all_orgs;
END;
$$;

-- Step 3: Clean up duplicate RLS policies on organizations table
-- First, drop the generic policies that might conflict
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete_policy" ON public.organizations;

-- Step 4: Ensure the correct policies are in place
-- Check if the proper named policies exist, if not create them
DO $$
BEGIN
  -- Create SELECT policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'organizations' 
    AND policyname = 'Platform admins can view all organizations'
  ) THEN
    CREATE POLICY "Platform admins can view all organizations" 
    ON public.organizations 
    FOR SELECT 
    TO authenticated 
    USING (
      get_user_type() = 'platform_admin' OR 
      get_member_role() = 'customer_success' OR
      id = get_user_organization_id()
    );
  END IF;

  -- Create INSERT policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'organizations' 
    AND policyname = 'Only platform admins and customer success can create organizations'
  ) THEN
    CREATE POLICY "Only platform admins and customer success can create organizations" 
    ON public.organizations 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (
      get_user_type() = 'platform_admin' OR 
      get_member_role() = 'customer_success'
    );
  END IF;

  -- Create UPDATE policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'organizations' 
    AND policyname = 'Platform admins and workspace owners can update organizations'
  ) THEN
    CREATE POLICY "Platform admins and workspace owners can update organizations" 
    ON public.organizations 
    FOR UPDATE 
    TO authenticated 
    USING (
      get_user_type() = 'platform_admin' OR 
      get_member_role() = 'customer_success' OR
      (id = get_user_organization_id() AND get_user_type() = 'workspace_owner')
    );
  END IF;

  -- Create DELETE policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'organizations' 
    AND policyname = 'Only platform admins can delete organizations'
  ) THEN
    CREATE POLICY "Only platform admins can delete organizations" 
    ON public.organizations 
    FOR DELETE 
    TO authenticated 
    USING (get_user_type() = 'platform_admin');
  END IF;
END $$;

-- Step 5: Add a function to check if all platform admins have proper member records
CREATE OR REPLACE FUNCTION public.audit_platform_admin_access()
RETURNS TABLE(
  user_email text,
  user_id uuid,
  has_member_record boolean,
  user_type text,
  member_role text,
  organization_id uuid,
  issue_description text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.email::text as user_email,
    au.id as user_id,
    (m.user_id IS NOT NULL) as has_member_record,
    COALESCE(m.user_type::text, 'NO_RECORD') as user_type,
    COALESCE(m.member_role::text, 'NO_RECORD') as member_role,
    m.organization_id,
    CASE 
      WHEN au.raw_user_meta_data->>'user_type' = 'platform_admin' AND m.user_id IS NULL 
        THEN 'Platform admin has no member record'
      WHEN au.raw_user_meta_data->>'user_type' = 'platform_admin' AND m.user_type::text != 'platform_admin'
        THEN 'Platform admin has incorrect user_type in members table'
      WHEN au.raw_user_meta_data->>'user_type' = 'platform_admin' AND m.organization_id IS NULL
        THEN 'Platform admin has no organization assignment'
      ELSE 'OK'
    END as issue_description
  FROM auth.users au
  LEFT JOIN public.members m ON au.id = m.user_id
  WHERE au.raw_user_meta_data->>'user_type' = 'platform_admin'
  ORDER BY au.email;
END;
$$;
