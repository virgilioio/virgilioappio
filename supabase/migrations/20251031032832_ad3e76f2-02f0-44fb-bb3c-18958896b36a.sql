-- Backfill owner_id from child workspaces to parent tenants
-- This fixes the missing "Owner Contact" issue in the SaaS Customers list
-- by copying the owner_id from child workspaces to their parent tenants

UPDATE organizations parent
SET owner_id = workspace.owner_id,
    updated_at = now()
FROM organizations workspace
WHERE workspace.parent_organization_id = parent.id
  AND parent.parent_organization_id IS NULL  -- Only parent tenants
  AND parent.tenant_type = 'saas'
  AND parent.owner_id IS NULL                -- Only update missing ones
  AND workspace.owner_id IS NOT NULL;        -- Only if workspace has owner

-- This will update approximately 4 tenants:
-- Test Account, Allan Bravo - Headhunting, BRAVO, KAO Furniture Designers Corp