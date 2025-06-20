
-- Add RLS policy to allow organization members to view jobs from their organization
CREATE POLICY "jobs_select_with_assignments" ON jobs
FOR SELECT USING (
  get_user_type() = 'platform_admin'
  OR organization_id = get_user_organization_id()
  OR is_user_assigned_to_job(id, auth.uid())
);
