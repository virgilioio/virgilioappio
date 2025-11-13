-- Delete Motive account data for fresh signup test
-- User: allan.bravo@gomotive.com (ID: 91a123a4-af84-48d0-8edb-13e44c2fbb4a)
-- Tenant: Motive (ID: d18d7362-2e61-4513-8c10-c686a4e07424)

-- Step 1: Delete profile
DELETE FROM profiles 
WHERE user_id = '91a123a4-af84-48d0-8edb-13e44c2fbb4a' 
  AND email = 'allan.bravo@gomotive.com';

-- Step 2: Delete tenant
DELETE FROM tenants 
WHERE id = 'd18d7362-2e61-4513-8c10-c686a4e07424' 
  AND name = 'Motive';

-- Verification: Ensure no Motive data remains
DO $$
DECLARE
  profile_count INTEGER;
  tenant_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM profiles WHERE email = 'allan.bravo@gomotive.com';
  SELECT COUNT(*) INTO tenant_count FROM tenants WHERE name ILIKE '%motive%';
  
  IF profile_count > 0 THEN
    RAISE EXCEPTION 'Profile deletion failed: % profiles remain', profile_count;
  END IF;
  
  IF tenant_count > 0 THEN
    RAISE EXCEPTION 'Tenant deletion failed: % Motive tenants remain', tenant_count;
  END IF;
  
  RAISE NOTICE 'Motive account cleanup successful: All database records deleted';
END $$;