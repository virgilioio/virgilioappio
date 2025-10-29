-- Allow recruiters and admins to create job assignments in their org hierarchy
CREATE POLICY "Recruiters can create job assignments"
  ON public.job_assignments
  FOR INSERT
  TO public
  WITH CHECK (
    check_org_member_access(organization_id, 'recruiter'::member_role)
  );

-- Allow recruiters and admins to delete job assignments in their org hierarchy
CREATE POLICY "Recruiters can delete job assignments"
  ON public.job_assignments
  FOR DELETE
  TO public
  USING (
    check_org_member_access(organization_id, 'recruiter'::member_role)
  );