-- ============================================================
-- Fix Jobs RLS: Remove ALL Policy, Add Hierarchy-Aware Policies
-- ============================================================
-- This prevents platform admins from seeing/managing SaaS customer jobs
-- while maintaining access to Virgilio + internal client org jobs

-- Drop the overly permissive ALL policy that bypasses hierarchy checks
DROP POLICY IF EXISTS "Platform admins can manage all jobs" ON public.jobs;

-- Create hierarchy-aware INSERT policy for platform admins
CREATE POLICY jobs_platform_admin_insert ON public.jobs
FOR INSERT
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  AND organization_id IN (
    SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
  )
);

-- Create hierarchy-aware UPDATE policy for platform admins
CREATE POLICY jobs_platform_admin_update ON public.jobs
FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  AND organization_id IN (
    SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
  )
);

-- Create hierarchy-aware DELETE policy for platform admins
CREATE POLICY jobs_platform_admin_delete ON public.jobs
FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  AND organization_id IN (
    SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
  )
);

COMMENT ON POLICY jobs_platform_admin_insert ON public.jobs IS 
  'Platform admins can only INSERT jobs in Virgilio hierarchy (excludes SaaS customers)';

COMMENT ON POLICY jobs_platform_admin_update ON public.jobs IS 
  'Platform admins can only UPDATE jobs in Virgilio hierarchy (excludes SaaS customers)';

COMMENT ON POLICY jobs_platform_admin_delete ON public.jobs IS 
  'Platform admins can only DELETE jobs in Virgilio hierarchy (excludes SaaS customers)';

-- Summary of jobs table RLS policies after this migration:
-- ✅ jobs_virgilio_hierarchy_exclude_saas (SELECT) - existing
-- ✅ jobs_platform_admin_insert (INSERT) - new, hierarchy-aware
-- ✅ jobs_platform_admin_update (UPDATE) - new, hierarchy-aware
-- ✅ jobs_platform_admin_delete (DELETE) - new, hierarchy-aware
-- ✅ "Org recruiters can insert jobs" (INSERT) - existing
-- ✅ "Org admins can manage org jobs" (UPDATE/DELETE) - existing
-- ✅ "Users assigned to job can view it" (SELECT) - existing