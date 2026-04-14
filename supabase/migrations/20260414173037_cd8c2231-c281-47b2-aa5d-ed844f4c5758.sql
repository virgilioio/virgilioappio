-- Add a simple SELECT policy for organizations that allows members to see
-- the organization they belong to and its hierarchy (parent + siblings + children)
-- This fixes job creation failing with "query would be affected by row-level security"
CREATE OR REPLACE FUNCTION public.user_is_member_of_org_hierarchy(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    JOIN public.organizations mo ON mo.id = m.organization_id
    WHERE m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND (
        -- Direct membership
        m.organization_id = target_org_id
        -- User's org is parent of target
        OR EXISTS (
          SELECT 1 FROM public.organizations o 
          WHERE o.id = target_org_id AND o.parent_organization_id = m.organization_id
        )
        -- Target is parent of user's org
        OR mo.parent_organization_id = target_org_id
        -- Siblings (same parent)
        OR (
          mo.parent_organization_id IS NOT NULL 
          AND EXISTS (
            SELECT 1 FROM public.organizations o 
            WHERE o.id = target_org_id AND o.parent_organization_id = mo.parent_organization_id
          )
        )
      )
  );
$$;

-- Drop and recreate the consolidated select policy to include the simpler function
DROP POLICY IF EXISTS organizations_select_consolidated ON public.organizations;

CREATE POLICY organizations_select_consolidated ON public.organizations
  FOR SELECT USING (
    -- Platform admins see everything in their tenant
    (
      EXISTS (
        SELECT 1 FROM members m
        WHERE m.user_id = auth.uid()
          AND m.user_status = 'active'
          AND m.user_type = 'platform_admin'
      )
      AND id IN (SELECT get_org_hierarchy(get_platform_tenant_id()))
    )
    -- Members see their org hierarchy via simple function
    OR user_is_member_of_org_hierarchy(id)
    -- Users assigned to jobs can see the job's org
    OR EXISTS (
      SELECT 1 FROM job_assignments ja
      JOIN jobs j ON ja.job_id = j.id
      WHERE ja.user_id = auth.uid()
        AND j.organization_id = organizations.id
    )
    -- Public postings
    OR organization_has_active_public_posting(id)
  );