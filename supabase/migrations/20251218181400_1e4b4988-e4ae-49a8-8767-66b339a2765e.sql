-- Drop the broken org-based policy (missing WITH CHECK)
DROP POLICY IF EXISTS "Org recruiters can manage automation emails" ON public.stage_automation_emails;

-- Create new tenant-based policy with proper WITH CHECK clause
CREATE POLICY "Tenant recruiters can manage automation emails" 
ON public.stage_automation_emails
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM stage_automations sa
    JOIN job_hiring_stages jhs ON jhs.id = sa.job_hiring_stage_id
    JOIN jobs j ON j.id = jhs.job_id
    JOIN members m ON m.tenant_id = j.tenant_id
    WHERE sa.id = stage_automation_emails.stage_automation_id
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
    FROM stage_automations sa
    JOIN job_hiring_stages jhs ON jhs.id = sa.job_hiring_stage_id
    JOIN jobs j ON j.id = jhs.job_id
    JOIN members m ON m.tenant_id = j.tenant_id
    WHERE sa.id = stage_automation_emails.stage_automation_id
    AND m.user_id = auth.uid()
    AND m.user_status = 'active'
    AND (
      m.user_type = 'workspace_owner'
      OR m.member_role IN ('admin', 'recruiter')
    )
  )
);