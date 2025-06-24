
-- Create completely RLS-free versions of the security functions
-- These functions temporarily disable RLS to avoid infinite recursion

CREATE OR REPLACE FUNCTION public.get_user_type()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  user_type_result text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 'guest';
  END IF;
  
  -- First check auth metadata for platform admin
  IF (auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin' THEN
    RETURN 'platform_admin';
  END IF;
  
  -- Temporarily disable RLS to avoid recursion, then re-enable
  SET LOCAL row_security = off;
  
  SELECT COALESCE(user_type::text, 'guest') INTO user_type_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  SET LOCAL row_security = on;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$$;

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
  
  -- Temporarily disable RLS to avoid recursion, then re-enable
  SET LOCAL row_security = off;
  
  SELECT COALESCE(member_role::text, 'guest') INTO member_role_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  SET LOCAL row_security = on;
  
  RETURN COALESCE(member_role_result, 'guest');
END;
$$;

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
  
  -- Temporarily disable RLS to avoid recursion, then re-enable
  SET LOCAL row_security = off;
  
  SELECT organization_id INTO org_id_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  SET LOCAL row_security = on;
  
  RETURN org_id_result;
END;
$$;

-- Fix the problematic RLS policy on members table that was causing recursion
-- Replace the platform admin policy with one that uses auth metadata directly
DROP POLICY IF EXISTS "members_platform_admin_access" ON public.members;

CREATE POLICY "members_platform_admin_access" ON public.members
FOR ALL
TO authenticated
USING (
  -- Use auth metadata directly instead of get_user_type() to avoid recursion
  (auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin'
);
