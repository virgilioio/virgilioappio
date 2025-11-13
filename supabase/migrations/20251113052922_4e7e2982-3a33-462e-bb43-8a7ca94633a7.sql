-- Update validate_tenant_domains_parent_org to check for 'root' instead of 'tenant'
-- This aligns with the tenant-department separation architecture where 'root' denotes
-- the primary organization entity for a tenant

CREATE OR REPLACE FUNCTION public.validate_tenant_domains_parent_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organizations o 
    WHERE o.id = NEW.tenant_id 
    AND o.org_kind = 'root'
    AND o.parent_organization_id IS NULL
  ) THEN
    RAISE EXCEPTION 'tenant_id must reference a parent tenant organization';
  END IF;
  RETURN NEW;
END;
$$;