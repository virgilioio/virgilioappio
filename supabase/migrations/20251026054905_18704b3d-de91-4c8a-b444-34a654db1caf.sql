-- Fix stage_automations RLS policies by splitting INSERT and other operations

-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS "Org recruiters can manage stage automations" ON public.stage_automations;

-- Create separate policy for INSERT operations with WITH CHECK
CREATE POLICY "Org recruiters can insert stage automations"
  ON public.stage_automations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_hiring_stages jhs
      JOIN public.jobs j ON j.id = jhs.job_id
      WHERE jhs.id = job_hiring_stage_id
        AND public.check_org_member_access(j.organization_id, 'recruiter')
    )
  );

-- Create policy for SELECT/UPDATE/DELETE operations with USING
CREATE POLICY "Org recruiters can view and manage stage automations"
  ON public.stage_automations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.job_hiring_stages jhs
      JOIN public.jobs j ON j.id = jhs.job_id
      WHERE jhs.id = stage_automations.job_hiring_stage_id
        AND public.check_org_member_access(j.organization_id, 'recruiter')
    )
  );