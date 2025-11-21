-- Fix signup process: Update assign_organization_tenant trigger to preserve explicit tenant_id for root orgs
CREATE OR REPLACE FUNCTION public.assign_organization_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  parent_tenant uuid;
  parent_kind public.org_kind_enum;
BEGIN
  -- Tenants cannot have parents and should point tenant_id to self
  IF NEW.org_kind = 'tenant' THEN
    NEW.parent_organization_id := NULL;
    NEW.tenant_id := NEW.id;
    RETURN NEW;
  END IF;

  -- For root organizations: if tenant_id is explicitly provided, keep it
  IF NEW.org_kind = 'root' AND NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- For non-tenant orgs, compute tenant from parent if provided
  IF NEW.parent_organization_id IS NOT NULL THEN
    SELECT o.tenant_id, o.org_kind
      INTO parent_tenant, parent_kind
    FROM public.organizations o
    WHERE o.id = NEW.parent_organization_id;

    IF parent_kind = 'tenant' THEN
      NEW.tenant_id := NEW.parent_organization_id;
    ELSE
      NEW.tenant_id := parent_tenant; -- inherit ancestor tenant
    END IF;
  END IF;
  -- If we reach here with no tenant_id set, leave it NULL for constraint to catch

  RETURN NEW;
END;
$function$;