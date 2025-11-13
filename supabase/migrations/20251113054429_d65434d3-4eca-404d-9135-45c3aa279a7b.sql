-- Phase 1: Delete orphaned CoreSignal usage records for Motive tenant
-- This must be done before deleting the organization due to FK constraints

DELETE FROM coresignal_usage 
WHERE tenant_id = 'd70f40cc-93d8-491d-bc86-a0f045d490a0';

-- Phase 2: Delete orphaned Motive root organization
DELETE FROM organizations 
WHERE id = 'd70f40cc-93d8-491d-bc86-a0f045d490a0' 
AND name = 'Motive' 
AND org_kind = 'root'
AND parent_organization_id IS NULL;

-- Verify complete deletion
DO $$
DECLARE
  remaining_org_count INTEGER;
  remaining_usage_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_org_count 
  FROM organizations 
  WHERE name ILIKE '%motive%';
  
  SELECT COUNT(*) INTO remaining_usage_count
  FROM coresignal_usage
  WHERE tenant_id = 'd70f40cc-93d8-491d-bc86-a0f045d490a0';
  
  IF remaining_org_count > 0 THEN
    RAISE EXCEPTION 'Motive organization still exists. Count: %', remaining_org_count;
  END IF;
  
  IF remaining_usage_count > 0 THEN
    RAISE EXCEPTION 'Motive CoreSignal usage still exists. Count: %', remaining_usage_count;
  END IF;
  
  RAISE NOTICE 'Motive tenant fully deleted. Ready for fresh signup test.';
END $$;