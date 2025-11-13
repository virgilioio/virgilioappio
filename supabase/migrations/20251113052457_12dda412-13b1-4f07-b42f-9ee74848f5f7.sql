-- Update remaining root-level organizations from 'tenant' to 'root'
-- This ensures consistency with the tenant-department separation architecture
-- where 'root' denotes the primary organization entity for a tenant

UPDATE public.organizations
SET org_kind = 'root'
WHERE parent_organization_id IS NULL
  AND org_kind = 'tenant';