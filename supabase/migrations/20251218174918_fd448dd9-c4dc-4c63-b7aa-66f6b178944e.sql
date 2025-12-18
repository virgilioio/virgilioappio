-- Drop the incorrect org-based SELECT policy
DROP POLICY IF EXISTS "Org members can view stage automations" ON public.stage_automations;

-- SELECT: All tenant members can view automations
CREATE POLICY "Tenant members can view stage automations"
ON public.stage_automations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.job_hiring_stages jhs
    JOIN public.jobs j ON j.id = jhs.job_id
    WHERE jhs.id = stage_automations.job_hiring_stage_id
      AND public.user_has_tenant_access(j.tenant_id)
  )
);

-- INSERT/UPDATE/DELETE: Workspace owners + admins/recruiters can manage
CREATE POLICY "Tenant recruiters can manage stage automations"
ON public.stage_automations FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.job_hiring_stages jhs
    JOIN public.jobs j ON j.id = jhs.job_id
    JOIN public.members m ON m.tenant_id = j.tenant_id
    WHERE jhs.id = stage_automations.job_hiring_stage_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND (
        m.user_type = 'workspace_owner'
        OR m.member_role IN ('admin', 'recruiter')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.job_hiring_stages jhs
    JOIN public.jobs j ON j.id = jhs.job_id
    JOIN public.members m ON m.tenant_id = j.tenant_id
    WHERE jhs.id = stage_automations.job_hiring_stage_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND (
        m.user_type = 'workspace_owner'
        OR m.member_role IN ('admin', 'recruiter')
      )
  )
);