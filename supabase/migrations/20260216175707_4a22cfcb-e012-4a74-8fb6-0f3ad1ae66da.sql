
-- Fix trigger: treat all-zeros UUID as "not set" and remove reference to non-existent j.level
CREATE OR REPLACE FUNCTION public.auto_set_job_posting_tenant_id()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_location TEXT;
BEGIN
  IF NEW.tenant_id IS NOT NULL 
     AND NEW.tenant_id != '00000000-0000-0000-0000-000000000000' THEN
    RETURN NEW;
  END IF;

  SELECT j.tenant_id, j.location
  INTO v_tenant_id, v_location
  FROM public.jobs j
  WHERE j.id = NEW.job_id;

  NEW.tenant_id := v_tenant_id;
  NEW.location := v_location;

  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine tenant_id for job_posting from job_id %', NEW.job_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Backfill broken postings
UPDATE job_postings 
SET tenant_id = j.tenant_id,
    location = j.location
FROM jobs j
WHERE job_postings.job_id = j.id
  AND job_postings.tenant_id = '00000000-0000-0000-0000-000000000000';
