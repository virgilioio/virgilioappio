-- Improve the activate_platform_asset function to handle constraint violations better
CREATE OR REPLACE FUNCTION public.activate_platform_asset(new_asset_id uuid, asset_type_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Use a single atomic operation to avoid constraint violations
  -- First, deactivate all existing assets of the same type
  UPDATE public.platform_assets 
  SET is_active = false, updated_at = now()
  WHERE asset_type = asset_type_param AND is_active = true AND id != new_asset_id;
  
  -- Then activate the new asset
  UPDATE public.platform_assets 
  SET is_active = true, updated_at = now()
  WHERE id = new_asset_id;
  
  -- Verify the operation succeeded
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset with id % not found', new_asset_id;
  END IF;
END;
$function$