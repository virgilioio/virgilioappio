-- Add defensive trigger to auto-populate tenant_id from organization_id
-- This provides defense-in-depth for member creation

CREATE OR REPLACE FUNCTION public.auto_set_member_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Auto-populate tenant_id from organization if not explicitly set
  IF NEW.tenant_id IS NULL AND NEW.organization_id IS NOT NULL THEN
    SELECT o.tenant_id INTO NEW.tenant_id
    FROM public.organizations o
    WHERE o.id = NEW.organization_id;
    
    IF NEW.tenant_id IS NULL THEN
      RAISE EXCEPTION 'Cannot determine tenant_id for organization %', NEW.organization_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_set_member_tenant_id
  BEFORE INSERT OR UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_member_tenant_id();