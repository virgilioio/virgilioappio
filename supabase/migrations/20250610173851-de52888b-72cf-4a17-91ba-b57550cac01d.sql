
-- Add missing fields to job_requests table
ALTER TABLE public.job_requests 
ADD COLUMN IF NOT EXISTS salary_min INTEGER,
ADD COLUMN IF NOT EXISTS salary_max INTEGER, 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id);

-- Create index for job_id lookup
CREATE INDEX IF NOT EXISTS idx_job_requests_job_id ON public.job_requests(job_id);
