-- Add explicit WITH CHECK policies so recruiters/admins can insert/update associations within their org
-- This addresses RLS violations when creating or moving pipeline associations

-- INSERT policy: allow org recruiters/admins to create associations for jobs in their org
CREATE POLICY "Recruiters can insert associations (with check)"
ON public.job_candidate_associations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_candidate_associations.job_id
      AND m.user_id = auth.uid()
      AND m.member_role IN ('admin','recruiter')
      AND m.user_status = 'active'
  )
);

-- UPDATE policy: ensure updated rows remain within org recruiter/admin permissions
CREATE POLICY "Recruiters can update associations (with check)"
ON public.job_candidate_associations
FOR UPDATE
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_candidate_associations.job_id
      AND m.user_id = auth.uid()
      AND m.member_role IN ('admin','recruiter')
      AND m.user_status = 'active'
  )
);
