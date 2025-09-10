-- First, let's check what tenant_type values are allowed
-- Then update the constraint to allow 'platform' value

-- Drop the existing check constraint
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_tenant_type_check;

-- Add the updated constraint that includes 'platform'
ALTER TABLE organizations 
ADD CONSTRAINT organizations_tenant_type_check 
CHECK (tenant_type IN ('internal', 'saas', 'platform'));

-- Now fix existing SaaS customers to have correct signup_source
-- Update organizations that were created via self-signup to have signup_source = 'self_serve'

-- First, let's identify and fix the known self-serve customers
-- BRAVO is a known SaaS customer that should be marked as self_serve
UPDATE organizations 
SET signup_source = 'self_serve',
    tenant_type = 'saas'
WHERE name = 'BRAVO' 
  AND parent_organization_id IS NULL
  AND signup_source = 'manual';

-- Update any organizations that have no parent and tenant_type = 'saas' to be self_serve
-- (These are likely SaaS customers that were miscategorized)
UPDATE organizations 
SET signup_source = 'self_serve'
WHERE parent_organization_id IS NULL 
  AND tenant_type = 'saas'
  AND signup_source = 'manual';

-- Ensure Virgilio platform organization is properly marked
UPDATE organizations 
SET signup_source = 'manual',
    tenant_type = 'platform'
WHERE name = 'Virgilio' 
  AND organization_type = 'platform';

-- Set default signup_source for organizations that don't have it set
-- All existing organizations without signup_source should be 'manual' 
-- (they were created before the self-serve flow existed)
UPDATE organizations 
SET signup_source = 'manual'
WHERE signup_source IS NULL;

-- Add a constraint to ensure signup_source is always set for new records
ALTER TABLE organizations 
ALTER COLUMN signup_source SET NOT NULL;

-- Add a check constraint to ensure valid signup_source values
ALTER TABLE organizations 
ADD CONSTRAINT valid_signup_source 
CHECK (signup_source IN ('manual', 'self_serve'));

-- Add logging for future signup source tracking
COMMENT ON COLUMN organizations.signup_source IS 'Tracks how the organization was created: manual (by Virgilio staff) or self_serve (via signup flow)';

-- Verify the changes
SELECT 
  name,
  organization_type,
  tenant_type,
  signup_source,
  parent_organization_id IS NULL as is_top_level,
  CASE 
    WHEN signup_source = 'manual' THEN 'Internal/Manual'
    WHEN signup_source = 'self_serve' THEN 'SaaS Customer'
    ELSE 'Unknown'
  END as classification
FROM organizations 
WHERE organization_type = 'client' OR organization_type = 'platform'
ORDER BY signup_source, name;