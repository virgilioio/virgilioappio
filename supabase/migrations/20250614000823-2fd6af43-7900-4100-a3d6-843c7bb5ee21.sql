
-- Update job_candidates table schema
-- Remove sensitive fields and add new location/salary/profile fields

-- Remove sensitive columns
ALTER TABLE public.job_candidates 
DROP COLUMN IF EXISTS candidate_email,
DROP COLUMN IF EXISTS resume_url;

-- Add new location fields
ALTER TABLE public.job_candidates 
ADD COLUMN location_country TEXT,
ADD COLUMN location_state TEXT,
ADD COLUMN location_city TEXT;

-- Add new salary fields
ALTER TABLE public.job_candidates 
ADD COLUMN salary_amount NUMERIC,
ADD COLUMN salary_currency TEXT DEFAULT 'USD',
ADD COLUMN salary_period TEXT;

-- Add profile summary field
ALTER TABLE public.job_candidates 
ADD COLUMN profile_summary TEXT;

-- Add check constraint for salary_period enum values
ALTER TABLE public.job_candidates 
ADD CONSTRAINT check_salary_period 
CHECK (salary_period IS NULL OR salary_period IN ('monthly', 'annually', 'hourly'));

-- Add comment for documentation
COMMENT ON COLUMN public.job_candidates.salary_period IS 'Salary period: monthly, annually, or hourly';
COMMENT ON COLUMN public.job_candidates.profile_summary IS 'Candidate profile summary (non-sensitive information only)';
COMMENT ON COLUMN public.job_candidates.location_country IS 'Candidate location country';
COMMENT ON COLUMN public.job_candidates.location_state IS 'Candidate location state/province';
COMMENT ON COLUMN public.job_candidates.location_city IS 'Candidate location city';
