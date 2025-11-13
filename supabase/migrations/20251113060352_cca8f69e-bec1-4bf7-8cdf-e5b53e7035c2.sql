-- Delete Motive account data (cleanup attempt #3)
-- Tenant/Org ID: 19b13acb-e299-41b9-bfcd-35b5f90643d5
-- User ID: 91a123a4-af84-48d0-8edb-13e44c2fbb4a

-- Step 1: Delete root organization (must be before tenant due to FK)
DELETE FROM organizations 
WHERE id = '19b13acb-e299-41b9-bfcd-35b5f90643d5' 
  AND name = 'Motive' 
  AND org_kind = 'root';

-- Step 2: Delete tenant
DELETE FROM tenants 
WHERE id = '19b13acb-e299-41b9-bfcd-35b5f90643d5' 
  AND name = 'Motive';

-- Verification
DO $$
DECLARE
  org_count INTEGER;
  tenant_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count FROM organizations WHERE name ILIKE '%motive%';
  SELECT COUNT(*) INTO tenant_count FROM tenants WHERE name ILIKE '%motive%';
  
  IF org_count > 0 THEN
    RAISE EXCEPTION 'Organization deletion failed: % Motive orgs remain', org_count;
  END IF;
  
  IF tenant_count > 0 THEN
    RAISE EXCEPTION 'Tenant deletion failed: % Motive tenants remain', tenant_count;
  END IF;
  
  RAISE NOTICE 'Motive database cleanup successful';
END $$;