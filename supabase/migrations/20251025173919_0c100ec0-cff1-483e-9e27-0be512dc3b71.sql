-- ============================================================
-- Fix job_hiring_stages RLS: Add INSERT, UPDATE, DELETE Policies
-- ============================================================
-- This enables organization members to manage hiring plans for their jobs
-- while maintaining proper data isolation between SaaS customers and platform admins

-- Add INSERT policy for organization members and assigned users
CREATE POLICY job_hiring_stages_org_member_insert ON public.job_hiring_stages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM jobs j
    JOIN members m ON j.organization_id = m.organization_id
    WHERE j.id = job_hiring_stages.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM job_assignments ja
    WHERE ja.job_id = job_hiring_stages.job_id
      AND ja.user_id = auth.uid()
  )
);

-- Add UPDATE policy for organization members and assigned users
CREATE POLICY job_hiring_stages_org_member_update ON public.job_hiring_stages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM jobs j
    JOIN members m ON j.organization_id = m.organization_id
    WHERE j.id = job_hiring_stages.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM job_assignments ja
    WHERE ja.job_id = job_hiring_stages.job_id
      AND ja.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM jobs j
    JOIN members m ON j.organization_id = m.organization_id
    WHERE j.id = job_hiring_stages.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM job_assignments ja
    WHERE ja.job_id = job_hiring_stages.job_id
      AND ja.user_id = auth.uid()
  )
);

-- Add DELETE policy for organization members and assigned users
CREATE POLICY job_hiring_stages_org_member_delete ON public.job_hiring_stages
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM jobs j
    JOIN members m ON j.organization_id = m.organization_id
    WHERE j.id = job_hiring_stages.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM job_assignments ja
    WHERE ja.job_id = job_hiring_stages.job_id
      AND ja.user_id = auth.uid()
  )
);

-- Add hierarchy-aware INSERT policy for platform admins
CREATE POLICY job_hiring_stages_platform_admin_insert ON public.job_hiring_stages
FOR INSERT
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  AND EXISTS (
    SELECT 1
    FROM jobs j
    WHERE j.id = job_hiring_stages.job_id
      AND j.organization_id IN (
        SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
      )
  )
);

-- Add hierarchy-aware UPDATE policy for platform admins
CREATE POLICY job_hiring_stages_platform_admin_update ON public.job_hiring_stages
FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  AND EXISTS (
    SELECT 1
    FROM jobs j
    WHERE j.id = job_hiring_stages.job_id
      AND j.organization_id IN (
        SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
      )
  )
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  AND EXISTS (
    SELECT 1
    FROM jobs j
    WHERE j.id = job_hiring_stages.job_id
      AND j.organization_id IN (
        SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
      )
  )
);

-- Add hierarchy-aware DELETE policy for platform admins
CREATE POLICY job_hiring_stages_platform_admin_delete ON public.job_hiring_stages
FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  AND EXISTS (
    SELECT 1
    FROM jobs j
    WHERE j.id = job_hiring_stages.job_id
      AND j.organization_id IN (
        SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
      )
  )
);

COMMENT ON POLICY job_hiring_stages_org_member_insert ON public.job_hiring_stages IS 
  'Organization members and assigned users can insert hiring stages for their jobs';

COMMENT ON POLICY job_hiring_stages_org_member_update ON public.job_hiring_stages IS 
  'Organization members and assigned users can update hiring stages for their jobs';

COMMENT ON POLICY job_hiring_stages_org_member_delete ON public.job_hiring_stages IS 
  'Organization members and assigned users can delete hiring stages from their jobs';

COMMENT ON POLICY job_hiring_stages_platform_admin_insert ON public.job_hiring_stages IS 
  'Platform admins can only INSERT hiring stages for jobs in Virgilio hierarchy (excludes SaaS customers)';

COMMENT ON POLICY job_hiring_stages_platform_admin_update ON public.job_hiring_stages IS 
  'Platform admins can only UPDATE hiring stages for jobs in Virgilio hierarchy (excludes SaaS customers)';

COMMENT ON POLICY job_hiring_stages_platform_admin_delete ON public.job_hiring_stages IS 
  'Platform admins can only DELETE hiring stages for jobs in Virgilio hierarchy (excludes SaaS customers)';

-- Summary of job_hiring_stages table RLS policies after this migration:
-- ✅ job_hiring_stages_org_member_insert (INSERT) - new, allows org members to add stages
-- ✅ job_hiring_stages_org_member_update (UPDATE) - new, allows org members to reorder stages
-- ✅ job_hiring_stages_org_member_delete (DELETE) - new, allows org members to remove stages
-- ✅ job_hiring_stages_platform_admin_insert (INSERT) - new, hierarchy-aware
-- ✅ job_hiring_stages_platform_admin_update (UPDATE) - new, hierarchy-aware
-- ✅ job_hiring_stages_platform_admin_delete (DELETE) - new, hierarchy-aware
-- ✅ "Users can view hiring stages for jobs they can access" (SELECT) - existing
-- ✅ "View job hiring stages - org member or assigned" (SELECT) - existing