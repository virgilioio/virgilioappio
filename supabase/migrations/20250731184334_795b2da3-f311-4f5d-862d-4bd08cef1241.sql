-- Create function to generate worker ID for organization
CREATE OR REPLACE FUNCTION public.generate_worker_id(org_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    next_id INTEGER;
BEGIN
    -- Get the next worker ID for this organization
    SELECT COALESCE(MAX(worker_id), 0) + 1 
    INTO next_id 
    FROM public.workers 
    WHERE organization_id = org_id;
    
    RETURN next_id;
END;
$function$;

-- Create trigger function to assign worker ID automatically
CREATE OR REPLACE FUNCTION public.assign_worker_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    -- Only assign worker_id if it's not already set
    IF NEW.worker_id IS NULL THEN
        NEW.worker_id = generate_worker_id(NEW.organization_id);
    END IF;
    RETURN NEW;
END;
$function$;

-- Create trigger to auto-assign worker_id on insert
DROP TRIGGER IF EXISTS trigger_assign_worker_id ON public.workers;
CREATE TRIGGER trigger_assign_worker_id
    BEFORE INSERT ON public.workers
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_worker_id();