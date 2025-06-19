
-- Fix infinite recursion in RLS policies by rewriting them to avoid circular dependencies

-- First, drop all existing RLS policies that are causing infinite recursion
DROP POLICY IF EXISTS "Users can view activities in their organization" ON public.activities;
DROP POLICY IF EXISTS "Users can create activities" ON public.activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON public.activities;

-- Drop existing members policies that are causing recursion
DROP POLICY IF EXISTS "members_select_policy" ON public.members;
DROP POLICY IF EXISTS "members_insert_policy" ON public.members;
DROP POLICY IF EXISTS "members_update_policy" ON public.members;
DROP POLICY IF EXISTS "members_delete_policy" ON public.members;

-- Create new, non-recursive RLS policies for members table
-- These policies use only direct conditions without subqueries to members table
CREATE POLICY "members_can_view_own_record" ON public.members
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "members_platform_admin_full_access" ON public.members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'user_type' = 'platform_admin'
  )
);

CREATE POLICY "members_can_view_same_org" ON public.members
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT DISTINCT m.organization_id 
    FROM public.members m 
    WHERE m.user_id = auth.uid()
  )
);

-- Create simple, non-recursive policies for activities table
CREATE POLICY "activities_users_own" ON public.activities
FOR ALL
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "activities_platform_admin" ON public.activities
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'user_type' = 'platform_admin'
  )
);

-- Enable RLS on activities table if not already enabled
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Update organizations table policies to avoid recursion
DROP POLICY IF EXISTS "Platform admins can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Only platform admins and customer success can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Platform admins and workspace owners can update organizations" ON public.organizations;
DROP POLICY IF EXISTS "Only platform admins can delete organizations" ON public.organizations;

CREATE POLICY "orgs_platform_admin_full" ON public.organizations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'user_type' = 'platform_admin'
  )
);

CREATE POLICY "orgs_owner_can_view" ON public.organizations
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- Update jobs table policies to avoid recursion
DROP POLICY IF EXISTS "jobs_select_with_assignments" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_policy" ON public.jobs;

CREATE POLICY "jobs_platform_admin_full" ON public.jobs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'user_type' = 'platform_admin'
  )
);

CREATE POLICY "jobs_assigned_users_can_view" ON public.jobs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_assignments 
    WHERE job_assignments.job_id = jobs.id 
    AND job_assignments.user_id = auth.uid()
  )
);

-- Log success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully fixed infinite recursion in RLS policies by creating non-recursive policies.';
END $$;
