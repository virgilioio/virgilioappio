-- Drop the existing RLS policy on sourcing_preview_candidates
DROP POLICY IF EXISTS "Org members can view preview candidates" ON public.sourcing_preview_candidates;
DROP POLICY IF EXISTS "Org members can insert preview candidates" ON public.sourcing_preview_candidates;
DROP POLICY IF EXISTS "Org members can update preview candidates" ON public.sourcing_preview_candidates;
DROP POLICY IF EXISTS "Org members can delete preview candidates" ON public.sourcing_preview_candidates;

-- Create corrected RLS policies using tenant_id for proper access control
-- Members are associated with parent tenants, not child organizations/departments

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
  OR (get_user_type_secure() = 'platform_admin')
);

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
  OR (get_user_type_secure() = 'platform_admin')
);

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
  OR (get_user_type_secure() = 'platform_admin')
);

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
  OR (get_user_type_secure() = 'platform_admin')
);