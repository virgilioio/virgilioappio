-- Fix candidates INSERT policy to allow recruiters and admins
DROP POLICY IF EXISTS candidates_insert_consolidated ON public.candidates;

CREATE POLICY candidates_insert_consolidated ON public.candidates
  FOR INSERT
  TO public
  WITH CHECK (
    user_has_org_hierarchy_access(organization_id) 
    AND (
      check_org_member_access(organization_id, 'recruiter'::member_role)
      OR check_org_member_access(organization_id, 'admin'::member_role)
    )
  );