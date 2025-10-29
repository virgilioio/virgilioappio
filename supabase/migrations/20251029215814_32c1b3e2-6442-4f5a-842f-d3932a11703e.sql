-- Critical Security Fix: Restrict candidate deletion to admin roles only
-- Drop the overly permissive DELETE policy that allowed any org member to delete
DROP POLICY IF EXISTS "Users can delete candidates in their organization" ON public.candidates;

-- Create new DELETE policy that only allows admins (platform_admin, workspace_owner, or member_role='admin')
CREATE POLICY "Admins can delete candidates in their organization"
  ON public.candidates
  FOR DELETE
  TO public
  USING (
    get_user_type_secure() = 'platform_admin'
    OR check_org_member_access(organization_id, 'admin'::member_role)
  );