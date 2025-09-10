-- Fix BRAVO organization data structure
-- The BRAVO with no parent should be a SaaS customer
UPDATE organizations 
SET tenant_type = 'saas'
WHERE name = 'BRAVO' 
  AND parent_organization_id IS NULL
  AND tenant_type = 'internal';

-- Verify the change
SELECT id, name, tenant_type, organization_type, parent_organization_id 
FROM organizations 
WHERE name IN ('BRAVO', 'Virgilio') 
ORDER BY name, parent_organization_id NULLS FIRST;