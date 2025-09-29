-- Fix the activate_platform_asset function to handle constraint violations properly
DROP FUNCTION IF EXISTS public.activate_platform_asset(uuid, text);

CREATE OR REPLACE FUNCTION public.activate_platform_asset(new_asset_id uuid, asset_type_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Use explicit transaction with constraint deferring
  SET CONSTRAINTS platform_assets_asset_type_is_active_key DEFERRED;
  
  -- First, deactivate all existing assets of the same type in a single operation
  UPDATE public.platform_assets 
  SET is_active = false, updated_at = now()
  WHERE asset_type = asset_type_param 
    AND is_active = true 
    AND id != new_asset_id;
  
  -- Then activate the new asset
  UPDATE public.platform_assets 
  SET is_active = true, updated_at = now()
  WHERE id = new_asset_id;
  
  -- Verify the operation succeeded
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset with id % not found', new_asset_id;
  END IF;
  
  -- Reset constraint checking
  SET CONSTRAINTS platform_assets_asset_type_is_active_key IMMEDIATE;
  
  RAISE LOG 'Successfully activated asset % of type %', new_asset_id, asset_type_param;
EXCEPTION
  WHEN unique_violation THEN
    RAISE LOG 'Constraint violation during asset activation: %', SQLERRM;
    -- Reset constraint checking in case of error
    SET CONSTRAINTS platform_assets_asset_type_is_active_key IMMEDIATE;
    RAISE EXCEPTION 'Failed to activate asset due to constraint violation. Please try again.';
  WHEN OTHERS THEN
    RAISE LOG 'Error during asset activation: %', SQLERRM;
    -- Reset constraint checking in case of error  
    SET CONSTRAINTS platform_assets_asset_type_is_active_key IMMEDIATE;
    RAISE;
END;
$$;