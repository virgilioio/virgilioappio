-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Public can view jobs with active postings" ON public.jobs;

-- Create a security definer function to check if a job has active postings
CREATE OR REPLACE FUNCTION public.job_has_active_posting(job_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.job_postings jp 
    WHERE jp.job_id = job_id_param 
    AND jp.is_active = true
  );
$$;

-- Create new policy using the security definer function
CREATE POLICY "Public can view jobs with active postings - safe" 
ON public.jobs 
FOR SELECT 
USING (public.job_has_active_posting(id));