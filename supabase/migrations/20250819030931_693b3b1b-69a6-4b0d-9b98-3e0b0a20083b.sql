-- Add public access policy for jobs table to allow viewing jobs with active postings
CREATE POLICY "Public can view jobs with active postings" 
ON public.jobs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.job_postings jp 
    WHERE jp.job_id = jobs.id 
    AND jp.is_active = true
  )
);