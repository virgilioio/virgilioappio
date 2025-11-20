-- Migration: Fix scheduled_bookings RLS policy - prevent users from seeing other users' interviews

BEGIN;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view relevant bookings" ON scheduled_bookings;

-- Create updated policy without job assignment condition
-- Users can now only see:
-- 1. Bookings where they are the interviewer
-- 2. All bookings if they are platform admin
-- 3. All bookings in their organization if they are workspace owner or admin
CREATE POLICY "Users can view relevant bookings" 
ON scheduled_bookings FOR SELECT 
USING (
  (get_user_type_secure() = 'platform_admin'::text) 
  OR (interviewer_id = auth.uid())
  OR ((organization_id IS NOT NULL) 
      AND user_has_org_hierarchy_access(organization_id) 
      AND (user_is_workspace_owner_in_tenant((SELECT organizations.tenant_id FROM organizations WHERE organizations.id = scheduled_bookings.organization_id)) 
           OR check_org_hierarchy_role_access(organization_id, 'admin'::text)))
);

COMMIT;