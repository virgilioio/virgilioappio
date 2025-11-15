-- Drop the current broken UPDATE policy
DROP POLICY IF EXISTS "Authorized users can update projects" ON public.sourcing_projects;

-- Create new UPDATE policy with hierarchy-aware role checking
CREATE POLICY "Authorized users can update projects"
ON public.sourcing_projects
FOR UPDATE
TO public
USING (
  -- Platform admins can update anything
  (get_user_type_secure() = 'platform_admin')
  OR
  -- For non-admins, they need recruiter+ role (hierarchy-aware) AND view access
  (
    -- Must have recruiter, admin, or workspace_owner role (hierarchy-aware)
    check_org_hierarchy_role_access(organization_id, 'recruiter')
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
    check_org_hierarchy_role_access(organization_id, 'recruiter')
    AND
    (
      (created_by = auth.uid())
      OR
      ((is_public = true) AND user_has_org_hierarchy_access(organization_id))
    )
  )
);