-- Create trigger function to auto-set tenant_id on activities table
CREATE OR REPLACE FUNCTION public.auto_set_activity_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- If tenant_id is already set, don't override it
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- If organization_id is set, derive tenant_id from it
  IF NEW.organization_id IS NOT NULL THEN
    SELECT o.tenant_id INTO NEW.tenant_id
    FROM public.organizations o
    WHERE o.id = NEW.organization_id;
    
    -- Log if tenant_id couldn't be derived
    IF NEW.tenant_id IS NULL THEN
      RAISE WARNING 'Could not derive tenant_id for activity with organization_id: %', NEW.organization_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger on activities table
DROP TRIGGER IF EXISTS trg_auto_set_activity_tenant_id ON public.activities;
CREATE TRIGGER trg_auto_set_activity_tenant_id
  BEFORE INSERT OR UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_activity_tenant_id();

-- Backfill existing NULL tenant_id values in activities table
UPDATE public.activities a
SET tenant_id = o.tenant_id
FROM public.organizations o
WHERE a.organization_id = o.id
  AND a.tenant_id IS NULL
  AND o.tenant_id IS NOT NULL;

-- Update log_activity RPC to accept optional tenant_id parameter
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id uuid,
  p_organization_id uuid,
  p_activity_type activity_type,
  p_title text,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  activity_id uuid;
  resolved_tenant_id uuid;
BEGIN
  -- Use provided tenant_id, or derive from organization_id
  resolved_tenant_id := p_tenant_id;
  
  IF resolved_tenant_id IS NULL AND p_organization_id IS NOT NULL THEN
    SELECT o.tenant_id INTO resolved_tenant_id
    FROM public.organizations o
    WHERE o.id = p_organization_id;
  END IF;

  INSERT INTO public.activities (
    user_id,
    organization_id,
    tenant_id,
    activity_type,
    title,
    description,
    metadata,
    entity_type,
    entity_id
  ) VALUES (
    p_user_id,
    p_organization_id,
    resolved_tenant_id,
    p_activity_type,
    p_title,
    p_description,
    p_metadata,
    p_entity_type,
    p_entity_id
  )
  RETURNING id INTO activity_id;

  RETURN activity_id;
END;
$function$;