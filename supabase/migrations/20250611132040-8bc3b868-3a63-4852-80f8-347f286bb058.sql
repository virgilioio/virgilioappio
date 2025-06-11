
-- Create helper function to get member role
CREATE OR REPLACE FUNCTION public.get_member_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(member_role::text, 'guest')
  FROM public.members 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$;

-- Update jobs table RLS policies with stricter role-based access
DROP POLICY IF EXISTS "jobs_insert_policy" ON jobs;
CREATE POLICY "jobs_insert_policy" ON jobs
FOR INSERT WITH CHECK (
  get_user_type() = 'platform_admin'
  OR (
    get_user_organization_id() = organization_id
    AND get_member_role() IN ('admin')
    AND get_user_type() != 'guest'
    AND get_user_organization_id() IS NOT NULL
  )
);

-- Update job_requests table RLS policies with stricter role-based access
DROP POLICY IF EXISTS "job_requests_insert_policy" ON job_requests;
CREATE POLICY "job_requests_insert_policy" ON job_requests
FOR INSERT WITH CHECK (
  get_user_type() = 'platform_admin'
  OR (
    get_user_organization_id() = organization_id
    AND get_member_role() IN ('admin', 'recruiter', 'client')
    AND get_user_type() != 'guest'
    AND get_user_organization_id() IS NOT NULL
  )
);

-- Add audit fields to job_requests table for approval tracking
ALTER TABLE job_requests 
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approver_role text;

-- Update existing approved records to have approval timestamp
UPDATE job_requests 
SET approved_at = updated_at 
WHERE status = 'approved' AND approved_at IS NULL;
