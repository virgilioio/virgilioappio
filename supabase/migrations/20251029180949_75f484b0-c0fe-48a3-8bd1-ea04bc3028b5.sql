-- Migration: Fix Remaining RLS Policy Conflicts for Recruiter Job Visibility
-- This migration updates broad SELECT policies to exclude recruiters, ensuring they only see assigned jobs

-- Step 1: Drop and recreate "Users can view jobs in their organization" policy with recruiter exclusion
DROP POLICY IF EXISTS "Users can view jobs in their organization" ON public.jobs;

CREATE POLICY "Users can view jobs in their organization" ON public.jobs
FOR SELECT
USING (
  (get_user_type_secure() = 'platform_admin')
  OR is_user_assigned_to_job(id)
  OR (
    user_has_org_hierarchy_access(organization_id)
    AND NOT (check_org_member_access(organization_id, 'recruiter'::member_role))
  )
);

-- Step 2: Drop and recreate "jobs_virgilio_hierarchy_exclude_saas" policy with recruiter exclusion
DROP POLICY IF EXISTS "jobs_virgilio_hierarchy_exclude_saas" ON public.jobs;

CREATE POLICY "jobs_virgilio_hierarchy_exclude_saas" ON public.jobs
FOR SELECT
USING (
  (
    (lower(split_part(get_user_email(), '@', 2)) = 'virgilio.tech')
    AND (organization_id IN (SELECT id FROM get_org_hierarchy('5ba7b145-f251-4b18-8900-724cb06028ab')))
    AND NOT (check_org_member_access(organization_id, 'recruiter'::member_role))
  )
  OR
  (
    (lower(split_part(get_user_email(), '@', 2)) <> 'virgilio.tech')
    AND (organization_id = get_user_organization_id())
  )
);