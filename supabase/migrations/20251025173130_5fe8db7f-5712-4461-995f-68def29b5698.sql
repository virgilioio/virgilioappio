-- ============================================================
-- Fix email_logs RLS: Remove ALL Policy, Add Hierarchy-Aware Policies
-- ============================================================
-- This prevents platform admins from seeing/managing SaaS customer email logs
-- while maintaining access to Virgilio + internal client org email logs

-- Drop the overly permissive ALL policy that bypasses hierarchy checks
DROP POLICY IF EXISTS "Platform admins can manage all email logs" ON public.email_logs;

-- Drop the existing UPDATE policy that allows platform admins to update any email log
DROP POLICY IF EXISTS "Users can update their own email logs" ON public.email_logs;

-- Create hierarchy-aware SELECT policy for platform admins
CREATE POLICY email_logs_platform_admin_select ON public.email_logs
FOR SELECT
USING (
  get_user_type_secure() = 'platform_admin'
  AND organization_id IN (
    SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
  )
);

-- Create UPDATE policy for regular users
CREATE POLICY email_logs_users_update ON public.email_logs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create hierarchy-aware UPDATE policy for platform admins
CREATE POLICY email_logs_platform_admin_update ON public.email_logs
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
CREATE POLICY email_logs_platform_admin_delete ON public.email_logs
FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  AND organization_id IN (
    SELECT id FROM public.get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab'::uuid)
  )
);

COMMENT ON POLICY email_logs_platform_admin_select ON public.email_logs IS 
  'Platform admins can only SELECT email logs in Virgilio hierarchy (excludes SaaS customers)';

COMMENT ON POLICY email_logs_users_update ON public.email_logs IS 
  'Users can update their own email logs';

COMMENT ON POLICY email_logs_platform_admin_update ON public.email_logs IS 
  'Platform admins can only UPDATE email logs in Virgilio hierarchy (excludes SaaS customers)';

COMMENT ON POLICY email_logs_platform_admin_delete ON public.email_logs IS 
  'Platform admins can only DELETE email logs in Virgilio hierarchy (excludes SaaS customers)';

-- Summary of email_logs table RLS policies after this migration:
-- ✅ email_logs_platform_admin_select (SELECT) - new, hierarchy-aware
-- ✅ email_logs_users_update (UPDATE) - new, user-specific
-- ✅ email_logs_platform_admin_update (UPDATE) - new, hierarchy-aware
-- ✅ email_logs_platform_admin_delete (DELETE) - new, hierarchy-aware
-- ✅ "Users can view their own email logs" (SELECT) - existing
-- ✅ "Users can insert their own email logs" (INSERT) - existing
-- ✅ "Users can delete their own email logs" (DELETE) - existing
-- ❌ No INSERT policy for platform admins - only edge functions should insert logs