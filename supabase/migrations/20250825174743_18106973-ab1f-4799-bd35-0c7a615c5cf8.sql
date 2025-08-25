-- Update existing organizations to set owner_id where it's NULL
-- but there's a workspace_owner member
UPDATE public.organizations
SET owner_id = m.user_id,
    updated_at = now()
FROM public.members m
WHERE organizations.id = m.organization_id
  AND organizations.owner_id IS NULL
  AND m.user_type = 'workspace_owner'
  AND m.user_status = 'active';