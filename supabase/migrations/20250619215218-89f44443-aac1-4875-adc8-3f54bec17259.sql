
-- Fix RLS policies to use get_user_type() instead of direct auth.users queries
-- This will resolve the 403 errors when fetching organizations and members

-- Drop existing problematic policies on organizations
DROP POLICY IF EXISTS "orgs_platform_admin_full" ON public.organizations;
DROP POLICY IF EXISTS "organizations_platform_admin" ON public.organizations;

-- Create new organizations policies using get_user_type()
CREATE POLICY "orgs_platform_admin_access" ON public.organizations
FOR ALL
TO authenticated
USING (get_user_type() = 'platform_admin');

CREATE POLICY "orgs_workspace_owner_view" ON public.organizations
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR get_user_type() = 'workspace_owner'
);

-- Drop existing problematic policies on members
DROP POLICY IF EXISTS "members_platform_admin_full_access" ON public.members;
DROP POLICY IF EXISTS "members_platform_admin" ON public.members;

-- Create new members policies using get_user_type()
CREATE POLICY "members_platform_admin_access" ON public.members
FOR ALL
TO authenticated
USING (get_user_type() = 'platform_admin');

-- Drop existing problematic policies on jobs
DROP POLICY IF EXISTS "jobs_platform_admin_full" ON public.jobs;
DROP POLICY IF EXISTS "jobs_platform_admin" ON public.jobs;

-- Create new jobs policies using get_user_type()
CREATE POLICY "jobs_platform_admin_access" ON public.jobs
FOR ALL
TO authenticated
USING (get_user_type() = 'platform_admin');

-- Drop existing problematic policies on activities
DROP POLICY IF EXISTS "activities_platform_admin" ON public.activities;

-- Create new activities policies using get_user_type()
CREATE POLICY "activities_platform_admin_access" ON public.activities
FOR ALL
TO authenticated
USING (get_user_type() = 'platform_admin');
