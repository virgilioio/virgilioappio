-- Phase 1: Auto-populate tenant_id for jobs table
CREATE OR REPLACE FUNCTION public.auto_set_job_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If tenant_id is not explicitly provided, derive it from organization_id
  IF NEW.tenant_id IS NULL THEN
    SELECT o.tenant_id INTO NEW.tenant_id
    FROM public.organizations o
    WHERE o.id = NEW.organization_id;
    
    -- Fail fast if we can't determine tenant_id
    IF NEW.tenant_id IS NULL THEN
      RAISE EXCEPTION 'Cannot determine tenant_id for organization %', NEW.organization_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger to jobs table
CREATE TRIGGER trg_auto_set_job_tenant_id
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_job_tenant_id();

-- Phase 2: Auto-populate tenant_id for email_logs table
CREATE OR REPLACE FUNCTION public.auto_set_email_log_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If tenant_id is not explicitly provided, derive it from organization_id
  IF NEW.tenant_id IS NULL THEN
    SELECT o.tenant_id INTO NEW.tenant_id
    FROM public.organizations o
    WHERE o.id = NEW.organization_id;
    
    -- For email logs, use WARNING instead of EXCEPTION to be more lenient
    IF NEW.tenant_id IS NULL THEN
      RAISE WARNING 'Could not determine tenant_id for email log with organization_id %', NEW.organization_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger to email_logs table
CREATE TRIGGER trg_auto_set_email_log_tenant_id
  BEFORE INSERT OR UPDATE ON public.email_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_email_log_tenant_id();