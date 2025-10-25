-- ============================================================
-- Restore Hierarchy Function with SaaS Exclusion
-- ============================================================

-- Recreate get_org_hierarchy with SaaS filtering
CREATE OR REPLACE FUNCTION public.get_org_hierarchy(root_org_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH RECURSIVE org_tree AS (
    -- Start with root org
    SELECT o.id, o.parent_organization_id, o.tenant_type
    FROM public.organizations o
    WHERE o.id = root_org_id
    
    UNION ALL
    
    -- Recursively get children, BUT exclude SaaS tenants
    SELECT o.id, o.parent_organization_id, o.tenant_type
    FROM public.organizations o
    INNER JOIN org_tree ot ON o.parent_organization_id = ot.id
    WHERE o.tenant_type != 'saas'  -- EXCLUDE SaaS customers
  )
  SELECT org_tree.id FROM org_tree;
$$;

-- ============================================================
-- Update Jobs SELECT Policy
-- ============================================================

-- Drop the simple isolation policy
DROP POLICY IF EXISTS jobs_simple_virgilio_isolation ON public.jobs;

-- Create new policy that uses hierarchy but excludes SaaS
CREATE POLICY jobs_virgilio_hierarchy_exclude_saas ON public.jobs
FOR SELECT
USING (
  -- Virgilio staff: see Virgilio + internal child orgs (NO SaaS)
  (
    lower(split_part(public.get_user_email(), '@', 2)) = 'virgilio.tech'
    AND jobs.organization_id IN (
      SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
    )
  )
  OR
  -- Everyone else: see their own org only
  (
    lower(split_part(public.get_user_email(), '@', 2)) != 'virgilio.tech'
    AND jobs.organization_id = public.get_user_organization_id()
  )
);

-- ============================================================
-- Documentation
-- ============================================================

COMMENT ON FUNCTION public.get_org_hierarchy(uuid) IS 
  'Returns organization hierarchy starting from root, excluding SaaS tenants from traversal';

COMMENT ON POLICY jobs_virgilio_hierarchy_exclude_saas ON public.jobs IS 
  'Virgilio staff see jobs from Virgilio org + internal child orgs (excludes SaaS). Others see only their own org jobs.';