-- ============================================================================
-- FIX: Add missing RLS policies for platform_assets table
-- ============================================================================
-- The legacy "Platform admins can manage platform assets" policy was dropped
-- during Phase 2 cleanup but never replaced, breaking asset uploads.
-- ============================================================================

-- Add comprehensive RLS policies for platform_assets
CREATE POLICY "Platform admins can insert platform assets"
ON public.platform_assets
FOR INSERT
WITH CHECK (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can update platform assets"
ON public.platform_assets
FOR UPDATE
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Platform admins can delete platform assets"
ON public.platform_assets
FOR DELETE
USING (get_user_type_secure() = 'platform_admin');

-- Note: The existing "Anyone can view active platform assets" SELECT policy remains unchanged

COMMENT ON POLICY "Platform admins can insert platform assets" ON public.platform_assets IS
'Allow platform admins to upload new assets';

COMMENT ON POLICY "Platform admins can update platform assets" ON public.platform_assets IS
'Allow platform admins to update asset records (e.g., activation status)';

COMMENT ON POLICY "Platform admins can delete platform assets" ON public.platform_assets IS
'Allow platform admins to remove assets';