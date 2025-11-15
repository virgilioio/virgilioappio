-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "organizations_select_consolidated" ON public.organizations;

-- Create new SELECT policy with direct EXISTS checks to avoid SECURITY DEFINER context issues
CREATE POLICY "organizations_select_consolidated" ON public.organizations
FOR SELECT
USING (
  -- Platform admins: check members table directly (no SECURITY DEFINER function call)
  (
    EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.user_status = 'active'
        AND m.user_type = 'platform_admin'
    )
    AND id IN (SELECT id FROM get_org_hierarchy(get_platform_tenant_id()))
  )
  -- Workspace owners & recruiters: can see orgs in their hierarchy
  OR user_has_org_hierarchy_access(id)
  -- Users with job assignments: can see those job's organizations
  OR EXISTS (
    SELECT 1 
    FROM job_assignments ja
    JOIN jobs j ON ja.job_id = j.id
    WHERE ja.user_id = auth.uid() 
      AND j.organization_id = organizations.id
  )
  -- Anyone: can see orgs with active public postings
  OR organization_has_active_public_posting(id)
);