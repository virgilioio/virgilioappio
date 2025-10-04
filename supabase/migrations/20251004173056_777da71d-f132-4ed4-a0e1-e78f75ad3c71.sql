-- Update resolve_org_context to check auth.users metadata for platform admin status
-- This fixes the race condition where platform admins were not detected during bootstrap

CREATE OR REPLACE FUNCTION public.resolve_org_context()
RETURNS TABLE(organization_id uuid, role text, user_type text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN QUERY SELECT null::uuid, null::text, 'guest'::text;
    RETURN;
  END IF;
  
  -- First check auth metadata for platform admin (same as get_user_member_data)
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = current_user_id 
    AND (raw_user_meta_data->>'user_type') = 'platform_admin'
  ) THEN
    -- For platform admins, get their member record but also return platform_admin type
    RETURN QUERY
    SELECT 
      m.organization_id,
      COALESCE(m.member_role::text, 'admin') as role,
      'platform_admin'::text as user_type
    FROM public.members m
    WHERE m.user_id = current_user_id 
      AND m.user_status = 'active'
    ORDER BY 
      CASE WHEN m.user_type = 'platform_admin' THEN 1 ELSE 2 END,
      m.created_at DESC
    LIMIT 1;
    
    -- If platform admin but no member record found, return default
    IF NOT FOUND THEN
      RETURN QUERY SELECT null::uuid, 'admin'::text, 'platform_admin'::text;
    END IF;
    RETURN;
  END IF;
  
  -- For regular users, get their member data
  RETURN QUERY
  SELECT 
    m.organization_id,
    m.member_role::text as role,
    COALESCE(m.user_type::text, 'guest') as user_type
  FROM public.members m
  WHERE m.user_id = current_user_id 
    AND m.user_status = 'active'
  ORDER BY m.created_at DESC
  LIMIT 1;
  
  -- If no member record found, return guest
  IF NOT FOUND THEN
    RETURN QUERY SELECT null::uuid, null::text, 'guest'::text;
  END IF;
END;
$function$;