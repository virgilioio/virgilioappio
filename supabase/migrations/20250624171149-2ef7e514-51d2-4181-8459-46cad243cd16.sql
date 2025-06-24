
-- Fix the "SET is not allowed in a non-volatile function" error
-- by making the functions VOLATILE or using a different approach

CREATE OR REPLACE FUNCTION public.get_user_type()
RETURNS text
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
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
  
  -- Use SECURITY DEFINER to bypass RLS without SET commands
  -- This works because SECURITY DEFINER runs with elevated privileges
  SELECT COALESCE(user_type::text, 'guest') INTO user_type_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_role()
RETURNS text
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  member_role_result text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 'guest';
  END IF;
  
  -- Use SECURITY DEFINER to bypass RLS without SET commands
  SELECT COALESCE(member_role::text, 'guest') INTO member_role_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  RETURN COALESCE(member_role_result, 'guest');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  org_id_result uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Use SECURITY DEFINER to bypass RLS without SET commands
  SELECT organization_id INTO org_id_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  RETURN org_id_result;
END;
$$;
