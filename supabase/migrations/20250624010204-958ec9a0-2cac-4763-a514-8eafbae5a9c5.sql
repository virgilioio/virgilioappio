
-- Fix the SELECT policy to allow both 'client' AND 'recruiter' roles with job assignments
DROP POLICY IF EXISTS "job_candidates_select_with_assignments" ON public.job_candidates;
CREATE POLICY "job_candidates_select_with_assignments" ON public.job_candidates FOR SELECT
USING (
  get_user_type() = 'platform_admin' OR
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_candidates.job_id
    AND (
      organization_id = get_user_organization_id() OR
      (get_member_role() IN ('client', 'recruiter') AND EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_id = jobs.id AND user_id = auth.uid()
      ))
    )
  )
);
