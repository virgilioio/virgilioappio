-- Create function to auto-set candidate tenant_id
CREATE OR REPLACE FUNCTION public.auto_set_candidate_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    
    -- Log if tenant_id couldn't be derived (shouldn't happen in normal flow)
    IF NEW.tenant_id IS NULL THEN
      RAISE WARNING 'Could not derive tenant_id for candidate with organization_id: %', NEW.organization_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to auto-set tenant_id on candidates
DROP TRIGGER IF EXISTS trg_auto_set_candidate_tenant_id ON public.candidates;

CREATE TRIGGER trg_auto_set_candidate_tenant_id
  BEFORE INSERT OR UPDATE ON public.candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_candidate_tenant_id();

-- Backfill existing NULL tenant_id values
UPDATE public.candidates c
SET tenant_id = o.tenant_id
FROM public.organizations o
WHERE c.organization_id = o.id
  AND c.tenant_id IS NULL
  AND o.tenant_id IS NOT NULL;

-- Log any remaining NULLs
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM public.candidates
  WHERE tenant_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE WARNING 'Still have % candidates with NULL tenant_id after backfill', null_count;
  ELSE
    RAISE NOTICE 'Successfully backfilled all candidate tenant_id values';
  END IF;
END $$;