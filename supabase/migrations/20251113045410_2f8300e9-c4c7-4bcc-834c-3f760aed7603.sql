-- Recreate get_user_type_secure function (required by validate_org_creation_permissions trigger)
CREATE OR REPLACE FUNCTION public.get_user_type_secure()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid;
  user_type_result text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 'guest';
  END IF;
  
  -- Check auth metadata first for platform_admin
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = current_user_id 
    AND (raw_user_meta_data->>'user_type') = 'platform_admin'
  ) THEN
    RETURN 'platform_admin';
  END IF;
  
  -- Bypass RLS to query members table
  SET LOCAL row_security = off;
  
  SELECT COALESCE(user_type::text, 'guest') INTO user_type_result
  FROM public.members 
  WHERE user_id = current_user_id 
    AND user_status = 'active'
  ORDER BY 
    CASE WHEN user_type = 'platform_admin' THEN 1 ELSE 2 END,
    created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$$;