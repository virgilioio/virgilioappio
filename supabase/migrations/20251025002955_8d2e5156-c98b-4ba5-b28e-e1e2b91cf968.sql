-- Fix job_candidate_associations RLS policies to allow organization members
-- This allows workspace owners, admins, and recruiters to manage associations
-- without requiring explicit job assignments

-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Assigned users can insert associations" 
ON public.job_candidate_associations;

-- Create new INSERT policy that includes org members
CREATE POLICY "Users can insert associations for accessible jobs"
ON public.job_candidate_associations
FOR INSERT
WITH CHECK (
  -- Platform admins can always insert
  get_user_type_secure() = 'platform_admin'
  OR
  -- Users explicitly assigned to the job
  is_user_assigned_to_job(job_id)
  OR
  -- Active organization members (workspace_owner, admin, or recruiter)
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_candidate_associations.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND (
        m.user_type = 'workspace_owner'
        OR m.member_role IN ('admin', 'recruiter')
      )
  )
);

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Assigned users can update associations" 
ON public.job_candidate_associations;

-- Create new UPDATE policy that includes org members
CREATE POLICY "Users can update associations for accessible jobs"
ON public.job_candidate_associations
FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  OR is_user_assigned_to_job(job_id)
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_candidate_associations.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND (m.user_type = 'workspace_owner' OR m.member_role IN ('admin', 'recruiter'))
  )
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR is_user_assigned_to_job(job_id)
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_candidate_associations.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND (m.user_type = 'workspace_owner' OR m.member_role IN ('admin', 'recruiter'))
  )
);

-- Drop existing DELETE policy
DROP POLICY IF EXISTS "Assigned users can delete associations" 
ON public.job_candidate_associations;

-- Create new DELETE policy that includes org members
CREATE POLICY "Users can delete associations for accessible jobs"
ON public.job_candidate_associations
FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  OR is_user_assigned_to_job(job_id)
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.members m ON j.organization_id = m.organization_id
    WHERE j.id = job_candidate_associations.job_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND (m.user_type = 'workspace_owner' OR m.member_role IN ('admin', 'recruiter'))
  )
);