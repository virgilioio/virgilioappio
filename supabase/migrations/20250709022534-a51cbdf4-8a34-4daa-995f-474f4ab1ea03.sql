-- Add skills column to job_candidates table
ALTER TABLE public.job_candidates 
ADD COLUMN skills TEXT[];

-- Add index for skills array for better performance
CREATE INDEX idx_job_candidates_skills ON public.job_candidates USING GIN(skills);