-- Fix search path issue in existing functions that need it
CREATE OR REPLACE FUNCTION public.get_user_type()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
  SELECT COALESCE(user_type::text, 'guest') INTO user_type_result
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid;
  org_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Use SECURITY DEFINER to bypass RLS without SET commands
  SELECT organization_id INTO org_id
  FROM public.members 
  WHERE user_id = current_user_id 
  LIMIT 1;
  
  RETURN org_id;
END;
$function$;