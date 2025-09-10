-- First add description column if it doesn't exist
ALTER TABLE platform_feature_flags 
ADD COLUMN IF NOT EXISTS description text;

-- Create a secure function to update feature flags
CREATE OR REPLACE FUNCTION public.update_feature_flag(
  flag_name_param text,
  is_active_param boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  old_value boolean;
  rows_affected integer;
BEGIN
  -- Only platform admins can update feature flags
  IF public.get_user_type_secure() != 'platform_admin' THEN
    RAISE EXCEPTION 'Only platform administrators can update feature flags';
  END IF;
  
  -- Get the current value
  SELECT is_active INTO old_value
  FROM public.platform_feature_flags
  WHERE flag_name = flag_name_param;
  
  -- Update the flag
  UPDATE public.platform_feature_flags
  SET is_active = is_active_param,
      updated_at = now()
  WHERE flag_name = flag_name_param;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  -- Insert if doesn't exist
  IF rows_affected = 0 THEN
    INSERT INTO public.platform_feature_flags (flag_name, is_active, description)
    VALUES (flag_name_param, is_active_param, 'Custom feature flag');
  END IF;
  
  -- Log the change
  RAISE LOG 'Feature flag % changed from % to % by user %', 
    flag_name_param, old_value, is_active_param, auth.uid();
  
  RETURN true;
END;
$$;

-- Create function to get all feature flags
CREATE OR REPLACE FUNCTION public.get_all_feature_flags()
RETURNS TABLE(
  flag_name text,
  is_active boolean,
  description text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only platform admins can view feature flags
  IF public.get_user_type_secure() != 'platform_admin' THEN
    RAISE EXCEPTION 'Only platform administrators can view feature flags';
  END IF;
  
  RETURN QUERY
  SELECT 
    pff.flag_name,
    pff.is_active,
    pff.description,
    pff.created_at,
    pff.updated_at
  FROM public.platform_feature_flags pff
  ORDER BY pff.flag_name;
END;
$$;

-- Add descriptions to existing feature flags
UPDATE public.platform_feature_flags 
SET description = 'Enables self-serve admin features for SaaS customer management'
WHERE flag_name = 'self_serve_admin_enabled' AND (description IS NULL OR description = '');