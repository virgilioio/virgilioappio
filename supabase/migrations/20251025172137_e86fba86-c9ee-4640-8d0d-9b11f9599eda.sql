-- ============================================================
-- Fix user_mail_identities RLS: Remove ALL Policy, Add Hierarchy-Aware Policies
-- ============================================================
-- This prevents platform admins from seeing/managing SaaS customer email identities
-- while maintaining access to Virgilio + internal client org email identities

-- Drop the overly permissive ALL policy that bypasses hierarchy checks
DROP POLICY IF EXISTS "Platform admins can manage all mail identities" ON public.user_mail_identities;

-- Create hierarchy-aware SELECT policy for platform admins
CREATE POLICY user_mail_identities_platform_admin_select ON public.user_mail_identities
FOR SELECT
USING (
  get_user_type_secure() = 'platform_admin'
  AND organization_id IN (
    SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
  )
);

-- Create hierarchy-aware UPDATE policy for platform admins
CREATE POLICY user_mail_identities_platform_admin_update ON public.user_mail_identities
FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  AND organization_id IN (
    SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
  )
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  AND organization_id IN (
    SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
  )
);

-- Create hierarchy-aware DELETE policy for platform admins
CREATE POLICY user_mail_identities_platform_admin_delete ON public.user_mail_identities
FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  AND organization_id IN (
    SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
  )
);

COMMENT ON POLICY user_mail_identities_platform_admin_select ON public.user_mail_identities IS 
  'Platform admins can only SELECT mail identities in Virgilio hierarchy (excludes SaaS customers)';

COMMENT ON POLICY user_mail_identities_platform_admin_update ON public.user_mail_identities IS 
  'Platform admins can only UPDATE mail identities in Virgilio hierarchy (excludes SaaS customers)';

COMMENT ON POLICY user_mail_identities_platform_admin_delete ON public.user_mail_identities IS 
  'Platform admins can only DELETE mail identities in Virgilio hierarchy (excludes SaaS customers)';

-- Summary of user_mail_identities table RLS policies after this migration:
-- ✅ user_mail_identities_platform_admin_select (SELECT) - new, hierarchy-aware
-- ✅ user_mail_identities_platform_admin_update (UPDATE) - new, hierarchy-aware
-- ✅ user_mail_identities_platform_admin_delete (DELETE) - new, hierarchy-aware
-- ✅ "Users can view their own mail identities" (SELECT) - existing
-- ✅ "Users can insert their own mail identities" (INSERT) - existing
-- ✅ "Users can update their own mail identities" (UPDATE) - existing
-- ✅ "Users can delete their own mail identities" (DELETE) - existing
-- ❌ No INSERT policy for platform admins - users should create their own identities