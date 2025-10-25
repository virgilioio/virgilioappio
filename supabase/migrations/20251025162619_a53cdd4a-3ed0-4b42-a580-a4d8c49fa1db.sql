-- ============================================================
-- Organizations Read Policy for Virgilio Staff
-- ============================================================

-- Add read-only policy for Virgilio staff to access org hierarchy
-- This allows them to traverse the organization tree for hierarchy calculations
CREATE POLICY organizations_read_for_staff
  ON public.organizations
  FOR SELECT
  USING (
    lower(split_part(public.get_user_email(), '@', 2)) = 'virgilio.tech'
    OR get_user_type_secure() = 'platform_admin'
  );

-- ============================================================
-- Organization Hierarchy Function (Aliased)
-- ============================================================

-- Create alias function with simplified name for easier use
CREATE OR REPLACE FUNCTION public.get_org_hierarchy(root_org_id uuid)
RETURNS TABLE (id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE orgs AS (
    SELECT o.id, o.parent_organization_id
    FROM public.organizations o
    WHERE o.id = root_org_id
    
    UNION ALL
    
    SELECT c.id, c.parent_organization_id
    FROM public.organizations c
    JOIN orgs ON c.parent_organization_id = orgs.id
  )
  SELECT id FROM orgs;
$$;

-- ============================================================
-- Update Jobs Tenant Isolation Policy
-- ============================================================

-- Drop existing tenant isolation policy
DROP POLICY IF EXISTS "jobs_tenant_isolation" ON public.jobs;
DROP POLICY IF EXISTS "jobs_temp_full_access_for_virgilio_staff" ON public.jobs;

-- Create new hierarchy-based policy for SELECT
CREATE POLICY "jobs_tenant_isolation" ON public.jobs
FOR SELECT
USING (
  -- Virgilio staff: force Virgilio root + all descendants
  (
    (
      lower(split_part(public.get_user_email(), '@', 2)) = 'virgilio.tech'
      OR get_user_type_secure() = 'platform_admin'
    )
    AND jobs.organization_id IN (
      SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
    )
  )
  OR
  -- SaaS tenants: use their JWT org hierarchy
  (
    lower(split_part(public.get_user_email(), '@', 2)) != 'virgilio.tech'
    AND get_user_type_secure() != 'platform_admin'
    AND public.get_user_organization_id() IS NOT NULL
    AND jobs.organization_id IN (
      SELECT id FROM public.get_org_hierarchy(public.get_user_organization_id())
    )
  )
);

-- ============================================================
-- Comments for Documentation
-- ============================================================

COMMENT ON POLICY "organizations_read_for_staff" ON public.organizations IS 
  'Allows Virgilio staff and platform admins to read organization tree for hierarchy calculations';

COMMENT ON FUNCTION public.get_org_hierarchy(uuid) IS 
  'Returns the full organization hierarchy (root + descendants) for a given organization ID. Alias for get_user_org_hierarchy.';

COMMENT ON POLICY "jobs_tenant_isolation" ON public.jobs IS 
  'Enforces organization hierarchy visibility: Virgilio staff see Virgilio tree, SaaS tenants see their own hierarchy only';