
-- Add skills column to jobs table
ALTER TABLE public.jobs 
ADD COLUMN skills TEXT[];

-- Add index for skills array for better performance
CREATE INDEX idx_jobs_skills ON public.jobs USING GIN(skills);
