-- Downgrade workspace_owner and guest users to member type in Virgilio hierarchy
-- This aligns with the SaaS model where workspace_owner is reserved for independent SaaS customers
-- Client hiring managers should be member type with hiring_manager role

UPDATE members
SET 
  user_type = 'member',
  updated_at = now()
WHERE id IN (
  SELECT m.id
  FROM members m
  JOIN organizations o ON o.id = m.organization_id
  WHERE o.id IN (
    SELECT id FROM get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab')
  )
  AND m.user_status = 'active'
  AND m.user_type != 'platform_admin'
  AND m.user_type != 'member'
);

-- Add comment for documentation
COMMENT ON TABLE members IS 
'Member records for organizations. In Virgilio hierarchy, client hiring managers are member type with hiring_manager role. workspace_owner type is reserved for independent SaaS customers only.';