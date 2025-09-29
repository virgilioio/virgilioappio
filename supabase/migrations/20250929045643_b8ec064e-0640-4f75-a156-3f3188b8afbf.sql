-- Fix platform asset upload constraint issue
-- Drop existing constraint and recreate as deferrable

-- Drop the existing constraint (this will also drop the dependent index)
ALTER TABLE public.platform_assets 
DROP CONSTRAINT IF EXISTS platform_assets_asset_type_is_active_key;

-- Create a partial unique index (only for active assets) 
CREATE UNIQUE INDEX platform_assets_asset_type_active_unique 
ON public.platform_assets (asset_type) 
WHERE is_active = true;

-- Create an exclusion constraint that can be deferred
ALTER TABLE public.platform_assets 
ADD CONSTRAINT platform_assets_asset_type_is_active_key 
EXCLUDE (asset_type WITH =) 
WHERE (is_active = true)
DEFERRABLE INITIALLY IMMEDIATE;