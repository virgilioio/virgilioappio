
-- Add missing personal detail fields
ALTER TABLE public.workers 
ADD COLUMN legal_first_name TEXT,
ADD COLUMN legal_last_name TEXT,
ADD COLUMN citizenship TEXT;

-- Add missing job detail fields
ALTER TABLE public.workers 
ADD COLUMN worker_id INTEGER,
ADD COLUMN reports JSONB DEFAULT '[]'::jsonb,
ADD COLUMN working_location TEXT,
ADD COLUMN scope_of_work TEXT;

-- Create new enums
CREATE TYPE seniority_level_enum AS ENUM ('entry', 'junior', 'mid', 'senior', 'lead', 'principal', 'director', 'vp', 'c_level');
CREATE TYPE payment_period_enum AS ENUM ('annual', 'monthly', 'semimonthly', 'biweekly', 'weekly', 'daily', 'hourly');
CREATE TYPE employment_terms_enum AS ENUM ('indefinite', 'definite');

-- Add new columns with enums
ALTER TABLE public.workers 
ADD COLUMN seniority_level seniority_level_enum,
ADD COLUMN base_salary NUMERIC(12,2),
ADD COLUMN payment_period payment_period_enum DEFAULT 'monthly',
ADD COLUMN employment_terms employment_terms_enum DEFAULT 'indefinite';

-- Create function to generate sequential worker IDs per organization
CREATE OR REPLACE FUNCTION generate_worker_id(org_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Create trigger function to auto-assign worker ID
CREATE OR REPLACE FUNCTION assign_worker_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only assign worker_id if it's not already set
    IF NEW.worker_id IS NULL THEN
        NEW.worker_id = generate_worker_id(NEW.organization_id);
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger to auto-assign worker ID on insert
CREATE TRIGGER trigger_assign_worker_id
    BEFORE INSERT ON public.workers
    FOR EACH ROW
    EXECUTE FUNCTION assign_worker_id();

-- Add comments for new columns
COMMENT ON COLUMN public.workers.legal_first_name IS 'Legal first name(s) of the worker';
COMMENT ON COLUMN public.workers.legal_last_name IS 'Legal last name(s) of the worker';
COMMENT ON COLUMN public.workers.citizenship IS 'Worker citizenship/nationality';
COMMENT ON COLUMN public.workers.worker_id IS 'Sequential worker ID within organization, auto-generated';
COMMENT ON COLUMN public.workers.reports IS 'Array of worker IDs that report to this worker';
COMMENT ON COLUMN public.workers.seniority_level IS 'Seniority level of the worker';
COMMENT ON COLUMN public.workers.working_location IS 'Physical or remote working location';
COMMENT ON COLUMN public.workers.scope_of_work IS 'Duties and responsibilities description';
COMMENT ON COLUMN public.workers.base_salary IS 'Base salary amount';
COMMENT ON COLUMN public.workers.payment_period IS 'How often the worker is paid';
COMMENT ON COLUMN public.workers.employment_terms IS 'Whether employment is indefinite or definite term';
