-- Fix platform admin access to SaaS customers
-- Update Virgilio organization tenant_type from 'platform' to 'saas'
-- This allows get_platform_tenant_id() to correctly identify the platform tenant

UPDATE public.organizations
SET 
  tenant_type = 'saas',
  updated_at = now()
WHERE id = '5ba7b145-f251-4b18-8900-724cb06028ab'
  AND name = 'Virgilio'
  AND organization_type = 'platform';

-- Verify the update
DO $$
DECLARE
  platform_id uuid;
  org_count integer;
BEGIN
  -- Check if get_platform_tenant_id() now works
  SELECT get_platform_tenant_id() INTO platform_id;
  
  IF platform_id IS NULL THEN
    RAISE EXCEPTION 'Migration failed: get_platform_tenant_id() still returns NULL';
  END IF;
  
  -- Check if we can see organizations in the hierarchy
  SELECT COUNT(*) INTO org_count 
  FROM get_org_hierarchy(platform_id);
  
  RAISE NOTICE 'Migration successful: get_platform_tenant_id() = %, org_hierarchy count = %', 
    platform_id, org_count;
END $$;