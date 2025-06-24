
-- First, drop the duplicate/older RLS policies on job_candidates table
DROP POLICY IF EXISTS "job_candidates_delete_policy" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_insert_policy" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_select_policy" ON public.job_candidates;
DROP POLICY IF EXISTS "job_candidates_update_policy" ON public.job_candidates;

-- Update the INSERT policy to match the SELECT policy logic (allow job assignments)
DROP POLICY IF EXISTS "job_candidates_insert" ON public.job_candidates;
CREATE POLICY "job_candidates_insert" ON public.job_candidates FOR INSERT
WITH CHECK (
  get_user_type() = 'platform_admin' OR
  (get_member_role() IN ('admin', 'recruiter') AND EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_candidates.job_id
    AND (
      organization_id = get_user_organization_id() OR
      (get_member_role() = 'recruiter' AND EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_id = jobs.id AND user_id = auth.uid()
      ))
    )
  ))
);

-- Update the UPDATE policy to match the SELECT policy logic (allow job assignments)
DROP POLICY IF EXISTS "job_candidates_update" ON public.job_candidates;
CREATE POLICY "job_candidates_update" ON public.job_candidates FOR UPDATE
USING (
  get_user_type() = 'platform_admin' OR
  (get_member_role() IN ('admin', 'recruiter') AND EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_candidates.job_id
    AND (
      organization_id = get_user_organization_id() OR
      (get_member_role() = 'recruiter' AND EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_id = jobs.id AND user_id = auth.uid()
      ))
    )
  ))
);
