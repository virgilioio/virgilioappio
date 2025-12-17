-- ============================================================================
-- Platform Admin Architecture Fix: Remove RLS bypasses for normal data views
-- Platform admins should be tenant-isolated for normal views
-- They access other tenants ONLY via dedicated admin features (SaaS Customers page)
-- ============================================================================

-- 1. Update ai_conversations SELECT policy
DROP POLICY IF EXISTS "ai_conversations_select" ON public.ai_conversations;
CREATE POLICY "ai_conversations_select" ON public.ai_conversations
  FOR SELECT USING (
    get_user_tenant_id() = tenant_id
  );

-- 2. Update platform_admin_all_conversations policy (remove)
DROP POLICY IF EXISTS "platform_admin_all_conversations" ON public.ai_conversations;

-- 3. Update sourcing_preview_candidates - remove platform_admin bypass
DROP POLICY IF EXISTS "Tenant members can view preview candidates" ON public.sourcing_preview_candidates;
CREATE POLICY "Tenant members can view preview candidates"
ON public.sourcing_preview_candidates
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM sourcing_projects sp
    JOIN organizations o ON o.id = sp.organization_id
    JOIN members m ON m.tenant_id = o.tenant_id
    WHERE sp.id = sourcing_preview_candidates.sourcing_project_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

DROP POLICY IF EXISTS "Tenant members can insert preview candidates" ON public.sourcing_preview_candidates;
CREATE POLICY "Tenant members can insert preview candidates"
ON public.sourcing_preview_candidates
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM sourcing_projects sp
    JOIN organizations o ON o.id = sp.organization_id
    JOIN members m ON m.tenant_id = o.tenant_id
    WHERE sp.id = sourcing_preview_candidates.sourcing_project_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

DROP POLICY IF EXISTS "Tenant members can update preview candidates" ON public.sourcing_preview_candidates;
CREATE POLICY "Tenant members can update preview candidates"
ON public.sourcing_preview_candidates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM sourcing_projects sp
    JOIN organizations o ON o.id = sp.organization_id
    JOIN members m ON m.tenant_id = o.tenant_id
    WHERE sp.id = sourcing_preview_candidates.sourcing_project_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

DROP POLICY IF EXISTS "Tenant members can delete preview candidates" ON public.sourcing_preview_candidates;
CREATE POLICY "Tenant members can delete preview candidates"
ON public.sourcing_preview_candidates
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM sourcing_projects sp
    JOIN organizations o ON o.id = sp.organization_id
    JOIN members m ON m.tenant_id = o.tenant_id
    WHERE sp.id = sourcing_preview_candidates.sourcing_project_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
  )
);

-- 4. Update email_suppression_list - tenant-only access for all users
DROP POLICY IF EXISTS "Platform admins can manage suppression list" ON public.email_suppression_list;
DROP POLICY IF EXISTS "Tenant members can view their suppression list" ON public.email_suppression_list;

CREATE POLICY "Tenant members can manage suppression list"
  ON public.email_suppression_list
  FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- 5. Update members SELECT policy - remove platform_admin bypass
DROP POLICY IF EXISTS "members_select_consolidated" ON public.members;
CREATE POLICY members_select_consolidated ON public.members
FOR SELECT
USING (
  -- Workspace owners see all members in their tenant
  public.user_is_workspace_owner_in_tenant(tenant_id)
  OR
  -- Users see members in their own tenant
  public.user_has_active_tenant_membership(tenant_id)
);

-- 6. Update candidates DELETE policy - remove platform_admin bypass
DROP POLICY IF EXISTS "candidates_delete_consolidated" ON public.candidates;
CREATE POLICY candidates_delete_consolidated ON public.candidates
FOR DELETE
USING (
  -- Only workspace owners can delete candidates in their tenant
  public.user_is_workspace_owner_in_tenant(tenant_id)
);

-- 7. Update job_stage_scorecards DELETE policy - remove platform_admin bypass
DROP POLICY IF EXISTS "Users can delete their own scorecards" ON public.job_stage_scorecards;
CREATE POLICY "Users can delete their own scorecards"
ON public.job_stage_scorecards
FOR DELETE
USING (created_by = auth.uid());

-- 8. Update scheduled_bookings policies - ensure tenant isolation
DROP POLICY IF EXISTS "scheduled_bookings_select" ON public.scheduled_bookings;
CREATE POLICY "scheduled_bookings_select" ON public.scheduled_bookings
FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  OR interviewer_id = auth.uid()
);

DROP POLICY IF EXISTS "scheduled_bookings_insert" ON public.scheduled_bookings;
CREATE POLICY "scheduled_bookings_insert" ON public.scheduled_bookings
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id()
  OR interviewer_id = auth.uid()
);

DROP POLICY IF EXISTS "scheduled_bookings_update" ON public.scheduled_bookings;
CREATE POLICY "scheduled_bookings_update" ON public.scheduled_bookings
FOR UPDATE
USING (
  tenant_id = get_user_tenant_id()
  OR interviewer_id = auth.uid()
);

DROP POLICY IF EXISTS "scheduled_bookings_delete" ON public.scheduled_bookings;
CREATE POLICY "scheduled_bookings_delete" ON public.scheduled_bookings
FOR DELETE
USING (
  tenant_id = get_user_tenant_id()
  OR interviewer_id = auth.uid()
);

-- Note: Keeping platform_admin access for administrative tables like:
-- - tenant_domains (cross-tenant admin management)
-- - platform_feature_flags (global platform config)
-- - platform_assets (global platform assets)
-- These are accessed via dedicated admin pages, not normal user views