-- Drop the restrictive UPDATE policy
DROP POLICY IF EXISTS "email_logs_users_update" ON public.email_logs;

-- Create new org-based UPDATE policy mirroring SELECT access
CREATE POLICY "email_logs_org_update" ON public.email_logs
FOR UPDATE TO authenticated
USING (
  user_has_org_hierarchy_access(organization_id) OR 
  ((job_id IS NOT NULL) AND is_user_assigned_to_job(job_id))
)
WITH CHECK (
  user_has_org_hierarchy_access(organization_id) OR 
  ((job_id IS NOT NULL) AND is_user_assigned_to_job(job_id))
);