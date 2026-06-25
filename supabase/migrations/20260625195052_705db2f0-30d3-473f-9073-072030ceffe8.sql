
-- Scope authenticated-only RLS policies on jobs and job_postings to the authenticated role
-- to break the anon-side recursion between jobs <-> job_postings.

-- job_postings
ALTER POLICY "job_postings_select_consolidated" ON public.job_postings TO authenticated;
ALTER POLICY "job_postings_insert_consolidated" ON public.job_postings TO authenticated;
ALTER POLICY "job_postings_update_consolidated" ON public.job_postings TO authenticated;
ALTER POLICY "job_postings_delete_consolidated" ON public.job_postings TO authenticated;
ALTER POLICY "Org members can view job postings" ON public.job_postings TO authenticated;
ALTER POLICY "Platform admins can manage all job postings - secure" ON public.job_postings TO authenticated;

-- jobs
ALTER POLICY "jobs_select_consolidated" ON public.jobs TO authenticated;
ALTER POLICY "jobs_insert_consolidated" ON public.jobs TO authenticated;
ALTER POLICY "jobs_update_consolidated" ON public.jobs TO authenticated;
