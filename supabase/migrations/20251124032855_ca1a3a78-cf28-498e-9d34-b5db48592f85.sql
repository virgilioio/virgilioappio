-- Add tenant_id, location, and job_type columns to job_postings for public display
ALTER TABLE public.job_postings 
ADD COLUMN tenant_id UUID,
ADD COLUMN location TEXT,
ADD COLUMN job_type TEXT;

-- Backfill existing job_postings with tenant_id, location, and job_type from jobs
UPDATE public.job_postings jp
SET 
  tenant_id = j.tenant_id,
  location = j.location,
  job_type = j.level::text
FROM public.jobs j
WHERE jp.job_id = j.id
  AND jp.tenant_id IS NULL;

-- Create trigger function to auto-populate tenant_id, location, and job_type
CREATE OR REPLACE FUNCTION public.auto_set_job_posting_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_location TEXT;
  v_job_type TEXT;
BEGIN
  -- If tenant_id is already set, keep it
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch tenant_id, location, and job_type from the parent job
  SELECT j.tenant_id, j.location, j.level::text
  INTO v_tenant_id, v_location, v_job_type
  FROM public.jobs j
  WHERE j.id = NEW.job_id;

  -- Set the values
  NEW.tenant_id := v_tenant_id;
  NEW.location := v_location;
  NEW.job_type := v_job_type;

  -- If we still don't have a tenant_id, raise an exception
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine tenant_id for job_posting from job_id %', NEW.job_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_auto_set_job_posting_tenant_id ON public.job_postings;
CREATE TRIGGER trg_auto_set_job_posting_tenant_id
  BEFORE INSERT OR UPDATE ON public.job_postings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_job_posting_tenant_id();

-- Set tenant_id to NOT NULL after backfill
ALTER TABLE public.job_postings 
ALTER COLUMN tenant_id SET NOT NULL;

-- Add index for efficient public careers page queries
CREATE INDEX IF NOT EXISTS idx_job_postings_tenant_active 
ON public.job_postings(tenant_id, is_active)
WHERE is_active = true;