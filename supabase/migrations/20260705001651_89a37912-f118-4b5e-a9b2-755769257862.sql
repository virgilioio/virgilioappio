GRANT SELECT ON public.scorecard_reminder_sends TO authenticated;

CREATE POLICY "Tenant members can view scorecard reminder sends"
ON public.scorecard_reminder_sends
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.job_candidate_associations jca
    JOIN public.jobs j ON j.id = jca.job_id
    WHERE jca.id = scorecard_reminder_sends.association_id
      AND public.user_has_tenant_access(j.tenant_id)
  )
);