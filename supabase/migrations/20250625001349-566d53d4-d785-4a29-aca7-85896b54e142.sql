
-- Fix RLS policies for job_candidates to properly handle recruiter job assignments

-- Drop the existing problematic policies
DROP POLICY IF EXISTS "job_candidates_insert" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_update" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_select_with_assignments" ON public.job_candidates;

-- Create comprehensive policies that handle both organization members and job assignments

-- SELECT policy: Allow access if user is in same org OR assigned to the job
CREATE POLICY "job_candidates_select_comprehensive" ON public.job_candidates FOR SELECT
USING (
  get_user_type() = 'platform_admin' OR
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_candidates.job_id
    AND (
      -- Same organization access
      organization_id = get_user_organization_id() OR
      -- Job assignment access (for recruiters assigned to jobs)
      EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_id = jobs.id AND user_id = auth.uid()
      )
    )
  )
);

-- INSERT policy: Allow creation if user is in same org OR assigned to the job
CREATE POLICY "job_candidates_insert_comprehensive" ON public.job_candidates FOR INSERT
WITH CHECK (
  get_user_type() = 'platform_admin' OR
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_candidates.job_id
    AND (
      -- Same organization access
      (organization_id = get_user_organization_id() AND get_member_role() IN ('admin', 'recruiter')) OR
      -- Job assignment access (for recruiters assigned to jobs from any organization)
      (get_member_role() IN ('client', 'recruiter') AND EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_id = jobs.id AND user_id = auth.uid()
      ))
    )
  )
);

-- UPDATE policy: Allow updates if user is in same org OR assigned to the job
CREATE POLICY "job_candidates_update_comprehensive" ON public.job_candidates FOR UPDATE
USING (
  get_user_type() = 'platform_admin' OR
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_candidates.job_id
    AND (
      -- Same organization access
      (organization_id = get_user_organization_id() AND get_member_role() IN ('admin', 'recruiter')) OR
      -- Job assignment access (for recruiters assigned to jobs from any organization)
      (get_member_role() IN ('client', 'recruiter') AND EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_id = jobs.id AND user_id = auth.uid()
      ))
    )
  )
);

-- DELETE policy: Allow deletion if user is in same org OR assigned to the job (admin level)
CREATE POLICY "job_candidates_delete_comprehensive" ON public.job_candidates FOR DELETE
USING (
  get_user_type() = 'platform_admin' OR
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_candidates.job_id
    AND (
      -- Same organization admin access
      (organization_id = get_user_organization_id() AND get_member_role() = 'admin') OR
      -- Job assignment access for platform admins only
      (get_user_type() = 'platform_admin' AND EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_id = jobs.id AND user_id = auth.uid()
      ))
    )
  )
);
