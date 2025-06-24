
-- Fix the INSERT policy to match the SELECT policy logic exactly
DROP POLICY IF EXISTS "job_candidates_insert" ON public.job_candidates;
CREATE POLICY "job_candidates_insert" ON public.job_candidates FOR INSERT
WITH CHECK (
  get_user_type() = 'platform_admin' OR
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_candidates.job_id
    AND (
      organization_id = get_user_organization_id() OR
      (get_member_role() = 'client' AND EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_id = jobs.id AND user_id = auth.uid()
      ))
    )
  )
);

-- Also fix the UPDATE policy to match the SELECT policy logic exactly
DROP POLICY IF EXISTS "job_candidates_update" ON public.job_candidates;
CREATE POLICY "job_candidates_update" ON public.job_candidates FOR UPDATE
USING (
  get_user_type() = 'platform_admin' OR
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_candidates.job_id
    AND (
      organization_id = get_user_organization_id() OR
      (get_member_role() = 'client' AND EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_id = jobs.id AND user_id = auth.uid()
      ))
    )
  )
);
