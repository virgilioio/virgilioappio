-- Fix organizations_before_insert trigger function to preserve explicit tenant_id
CREATE OR REPLACE FUNCTION public.organizations_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If tenant_id is already provided (e.g. from provision-tenant), do not override it
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- If this org has a parent, inherit its tenant_id
  IF NEW.parent_organization_id IS NOT NULL THEN
    SELECT o.tenant_id
      INTO NEW.tenant_id
    FROM public.organizations o
    WHERE o.id = NEW.parent_organization_id;

    -- Safety check: parent must have a tenant_id
    IF NEW.tenant_id IS NULL THEN
      RAISE EXCEPTION 'Parent organization % has NULL tenant_id in organizations_before_insert', NEW.parent_organization_id;
    END IF;
  END IF;

  -- For root/tenant orgs with NULL tenant_id, the assign_organization_tenant() trigger
  -- will set tenant_id = id. We intentionally do NOT touch tenant_id here.
  RETURN NEW;
END;
$$;
