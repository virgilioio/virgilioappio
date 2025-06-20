
-- Add foreign key constraints to job_requests table
ALTER TABLE public.job_requests 
ADD CONSTRAINT fk_job_requests_submitted_by 
FOREIGN KEY (submitted_by) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.job_requests 
ADD CONSTRAINT fk_job_requests_approved_by 
FOREIGN KEY (approved_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- Note: organization_id and job_id foreign keys already exist based on the schema
-- But let's verify and add them if missing:

-- Check if organization_id FK exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'job_requests_organization_id_fkey' 
        AND table_name = 'job_requests'
    ) THEN
        ALTER TABLE public.job_requests 
        ADD CONSTRAINT job_requests_organization_id_fkey 
        FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Check if job_id FK exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'job_requests_job_id_fkey' 
        AND table_name = 'job_requests'
    ) THEN
        ALTER TABLE public.job_requests 
        ADD CONSTRAINT job_requests_job_id_fkey 
        FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;
    END IF;
END $$;
