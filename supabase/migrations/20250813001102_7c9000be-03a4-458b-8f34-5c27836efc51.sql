
-- Allow job-assigned users (even if not org members) to manage pipeline associations
-- Uses existing security definer function: public.is_user_assigned_to_job(job_id uuid, user_id uuid default auth.uid())

-- INSERT: allow adding an association if the user is assigned to the target job
CREATE POLICY "Assigned users can insert associations"
ON public.job_candidate_associations
FOR INSERT
WITH CHECK (public.is_user_assigned_to_job(job_id));

-- UPDATE: allow moving stages / updating rows when the user is assigned to the job
CREATE POLICY "Assigned users can update associations"
ON public.job_candidate_associations
FOR UPDATE
USING (public.is_user_assigned_to_job(job_id))
WITH CHECK (public.is_user_assigned_to_job(job_id));

-- DELETE: parity, allow removal by assigned users
CREATE POLICY "Assigned users can delete associations"
ON public.job_candidate_associations
FOR DELETE
USING (public.is_user_assigned_to_job(job_id));
