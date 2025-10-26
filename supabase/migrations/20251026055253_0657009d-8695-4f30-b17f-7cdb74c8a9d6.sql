-- Enable RLS on stage_automation_emails
ALTER TABLE public.stage_automation_emails ENABLE ROW LEVEL SECURITY;

-- Policy for INSERT operations
CREATE POLICY "Org recruiters can insert stage automation emails"
  ON public.stage_automation_emails FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stage_automations sa
      JOIN public.job_hiring_stages jhs ON jhs.id = sa.job_hiring_stage_id
      JOIN public.jobs j ON j.id = jhs.job_id
      WHERE sa.id = stage_automation_id
        AND public.check_org_member_access(j.organization_id, 'recruiter')
    )
  );

-- Policy for SELECT/UPDATE/DELETE operations
CREATE POLICY "Org recruiters can view and manage stage automation emails"
  ON public.stage_automation_emails FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.stage_automations sa
      JOIN public.job_hiring_stages jhs ON jhs.id = sa.job_hiring_stage_id
      JOIN public.jobs j ON j.id = jhs.job_id
      WHERE sa.id = stage_automation_emails.stage_automation_id
        AND public.check_org_member_access(j.organization_id, 'recruiter')
    )
  );