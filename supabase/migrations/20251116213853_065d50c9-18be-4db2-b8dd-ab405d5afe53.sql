-- Fix scheduled_bookings RLS to respect user privacy
-- Remove overly permissive policy that allows all org members to see all bookings

-- Drop the problematic policy
DROP POLICY IF EXISTS "Org members can view org bookings" ON scheduled_bookings;

-- Create a more restrictive policy that respects user access boundaries
CREATE POLICY "Users can view relevant bookings"
  ON scheduled_bookings FOR SELECT
  USING (
    -- Platform admins can see all
    get_user_type_secure() = 'platform_admin'
    -- OR user is the interviewer
    OR interviewer_id = auth.uid()
    -- OR user is workspace owner/admin in the org (hierarchy-aware)
    OR (
      organization_id IS NOT NULL 
      AND user_has_org_hierarchy_access(organization_id)
      AND (
        user_is_workspace_owner_in_tenant(
          (SELECT tenant_id FROM organizations WHERE id = organization_id)
        )
        OR check_org_hierarchy_role_access(organization_id, 'admin')
      )
    )
    -- OR user is assigned to the job as recruiter/hiring manager
    OR (
      job_id IS NOT NULL
      AND is_user_assigned_to_job(job_id)
    )
  );

-- Update the UPDATE policy to match the new access pattern
DROP POLICY IF EXISTS "Interviewers can update own bookings" ON scheduled_bookings;

CREATE POLICY "Users can update relevant bookings"
  ON scheduled_bookings FOR UPDATE
  USING (
    -- Platform admins can update all
    get_user_type_secure() = 'platform_admin'
    -- OR user is the interviewer
    OR interviewer_id = auth.uid()
    -- OR user is workspace owner in the org
    OR (
      organization_id IS NOT NULL 
      AND user_is_workspace_owner_in_tenant(
        (SELECT tenant_id FROM organizations WHERE id = organization_id)
      )
    )
  );

-- Add comment explaining the access control model
COMMENT ON POLICY "Users can view relevant bookings" ON scheduled_bookings IS 
  'Users can only view bookings where they are the interviewer, assigned to the job, or are workspace owners/admins. This ensures privacy in multi-user organizations.';