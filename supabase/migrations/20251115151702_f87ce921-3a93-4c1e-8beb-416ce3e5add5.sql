-- Drop the overly restrictive UPDATE policy
DROP POLICY IF EXISTS "Creators can update their projects" ON public.sourcing_projects;

-- Create new UPDATE policy matching the SELECT access logic
CREATE POLICY "Authorized users can update projects"
ON public.sourcing_projects
FOR UPDATE
TO public
USING (
  -- Platform admins can update anything
  (get_user_type_secure() = 'platform_admin')
  OR
  -- For non-admins, they need recruiter+ role AND view access
  (
    -- Must have recruiter, admin, or workspace_owner role
    check_org_member_access(organization_id, 'recruiter')
    AND
    -- Must have view access (creator OR public project in their org hierarchy)
    (
      (created_by = auth.uid())
      OR
      ((is_public = true) AND user_has_org_hierarchy_access(organization_id))
    )
  )
)
WITH CHECK (
  -- Same conditions for WITH CHECK
  (get_user_type_secure() = 'platform_admin')
  OR
  (
    check_org_member_access(organization_id, 'recruiter')
    AND
    (
      (created_by = auth.uid())
      OR
      ((is_public = true) AND user_has_org_hierarchy_access(organization_id))
    )
  )
);