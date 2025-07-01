
-- Add linkedin_url column to job_candidates table
ALTER TABLE public.job_candidates 
ADD COLUMN linkedin_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.job_candidates.linkedin_url IS 'Candidate LinkedIn profile URL';
