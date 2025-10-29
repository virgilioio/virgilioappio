-- Allow recruiters to view members in their organization hierarchy
-- This enables recruiters to see users they can assign to jobs
CREATE POLICY "Recruiters can view org members"
  ON public.members
  FOR SELECT
  TO public
  USING (
    check_org_member_access(organization_id, 'recruiter'::member_role)
  );