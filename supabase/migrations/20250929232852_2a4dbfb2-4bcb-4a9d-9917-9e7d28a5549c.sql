-- Fix the get_user_member_data function to handle authentication context properly
CREATE OR REPLACE FUNCTION public.get_user_member_data()
RETURNS TABLE(user_type text, member_role text, organization_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Add logging for debugging
  RAISE LOG 'get_user_member_data called for user: %', current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE LOG 'No authenticated user found';
    RETURN QUERY SELECT 'guest'::text, null::text, null::uuid;
    RETURN;
  END IF;
  
  -- First check auth metadata for platform admin
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = current_user_id 
    AND (raw_user_meta_data->>'user_type') = 'platform_admin'
  ) THEN
    -- For platform admins, get their member record but also return platform_admin type
    RETURN QUERY
    SELECT 
      'platform_admin'::text as user_type,
      COALESCE(m.member_role::text, 'admin') as member_role,
      m.organization_id
    FROM public.members m
    WHERE m.user_id = current_user_id 
      AND m.user_status = 'active'
    ORDER BY 
      CASE WHEN m.user_type = 'platform_admin' THEN 1 ELSE 2 END,
      m.created_at DESC
    LIMIT 1;
    
    -- If platform admin but no member record found, return default
    IF NOT FOUND THEN
      RETURN QUERY SELECT 'platform_admin'::text, 'admin'::text, null::uuid;
    END IF;
    RETURN;
  END IF;
  
  -- For regular users, get their member data
  RETURN QUERY
  SELECT 
    COALESCE(m.user_type::text, 'guest') as user_type,
    m.member_role::text as member_role,
    m.organization_id
  FROM public.members m
  WHERE m.user_id = current_user_id 
    AND m.user_status = 'active'
  ORDER BY m.created_at DESC
  LIMIT 1;
  
  -- If no member record found, return guest
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'guest'::text, null::text, null::uuid;
  END IF;
END;
$function$;

-- Add a function to get user organization with fallback to Virgilio for platform admins
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid;
  result uuid;
  is_platform_admin boolean := false;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN null;
  END IF;
  
  -- Check if user is platform admin
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = current_user_id 
    AND (raw_user_meta_data->>'user_type') = 'platform_admin'
  ) INTO is_platform_admin;
  
  -- Get the user's primary organization
  SELECT m.organization_id INTO result
  FROM public.members m
  WHERE m.user_id = current_user_id 
    AND m.user_status = 'active'
  ORDER BY 
    CASE WHEN m.user_type = 'platform_admin' THEN 1 ELSE 2 END,
    CASE WHEN is_platform_admin AND EXISTS (
      SELECT 1 FROM public.organizations o 
      WHERE o.id = m.organization_id 
      AND o.name = 'Virgilio'
    ) THEN 1 ELSE 2 END,
    m.created_at DESC
  LIMIT 1;
  
  RETURN result;
END;
$function$;