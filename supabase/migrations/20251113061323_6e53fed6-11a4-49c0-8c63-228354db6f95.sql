-- Delete Motive account data (cleanup #4)
-- Tenant/Org ID: 3fc65012-7ac0-4b75-b1a9-f276862c8fdf
-- User ID: 91a123a4-af84-48d0-8edb-13e44c2fbb4a

-- Delete root organization first (FK dependency)
DELETE FROM organizations 
WHERE id = '3fc65012-7ac0-4b75-b1a9-f276862c8fdf' 
  AND name = 'Motive' 
  AND org_kind = 'root';

-- Delete tenant
DELETE FROM tenants 
WHERE id = '3fc65012-7ac0-4b75-b1a9-f276862c8fdf' 
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
  
  RAISE NOTICE 'Motive database cleanup successful - ready for fresh signup';
END $$;