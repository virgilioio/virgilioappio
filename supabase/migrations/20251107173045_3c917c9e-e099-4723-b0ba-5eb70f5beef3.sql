-- Add RLS policies for email_logs table to support job-assignment-based access
-- Users can view/log emails if they have org access OR are assigned to the job

-- SELECT policy: Users can view emails if they have org access OR are assigned to the job
CREATE POLICY "email_logs_select_consolidated"
ON email_logs
FOR SELECT
USING (
  user_has_org_hierarchy_access(organization_id)
  OR
  (job_id IS NOT NULL AND is_user_assigned_to_job(job_id))
);

-- INSERT policy: Users can log emails if (they have org access + recruiter role) OR are assigned to the job
CREATE POLICY "email_logs_insert_consolidated"
ON email_logs
FOR INSERT
WITH CHECK (
  (
    user_has_org_hierarchy_access(organization_id)
    AND check_org_member_access(organization_id, 'recruiter'::member_role)
  )
  OR
  (job_id IS NOT NULL AND is_user_assigned_to_job(job_id))
);

-- Add comments for documentation
COMMENT ON POLICY "email_logs_select_consolidated" ON email_logs IS 
'Allows users to view emails for jobs they have access to through org hierarchy or job assignment';

COMMENT ON POLICY "email_logs_insert_consolidated" ON email_logs IS 
'Allows recruiters and assigned users to log emails for candidates in their accessible jobs';