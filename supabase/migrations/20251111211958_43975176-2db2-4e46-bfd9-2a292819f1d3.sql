-- ============================================================================
-- ADD: Missing RLS policies for coresignal_usage table
-- ============================================================================
-- During Phase 2 audit, the "Platform admins can manage all CoreSignal usage"
-- policy was dropped but never replaced. This migration adds back the necessary
-- INSERT and UPDATE policies for the table.
-- ============================================================================

-- Policy 1: Platform admins can insert usage records
CREATE POLICY "Platform admins can insert CoreSignal usage records"
ON public.coresignal_usage
FOR INSERT
TO public
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
);

-- Policy 2: Platform admins can update CoreSignal usage records
CREATE POLICY "Platform admins can update CoreSignal usage records"
ON public.coresignal_usage
FOR UPDATE
TO public
USING (
  get_user_type_secure() = 'platform_admin'
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
);

-- Policy 3: Tenant members can insert usage records for their own tenant
-- (Allows the frontend hook to create initial usage records)
CREATE POLICY "Tenant members can initialize usage records"
ON public.coresignal_usage
FOR INSERT
TO public
WITH CHECK (
  tenant_id IN (
    SELECT o.tenant_id
    FROM organizations o
    JOIN members m ON m.organization_id = o.id
    WHERE m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

COMMENT ON POLICY "Platform admins can insert CoreSignal usage records" ON public.coresignal_usage IS
'Allows platform administrators to create usage records for any tenant';

COMMENT ON POLICY "Platform admins can update CoreSignal usage records" ON public.coresignal_usage IS
'Allows platform administrators to update usage records for any tenant';

COMMENT ON POLICY "Tenant members can initialize usage records" ON public.coresignal_usage IS
'Allows tenant members to create initial usage records for their own tenant when none exist for the current billing cycle';