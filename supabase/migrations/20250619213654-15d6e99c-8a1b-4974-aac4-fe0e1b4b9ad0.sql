
-- EMERGENCY RECOVERY: Complete RLS Policy Cleanup and Rebuild
-- This migration will drop ALL existing problematic policies and create simple, working ones

-- Step 1: Drop ALL existing RLS policies on problematic tables
DO $$ 
DECLARE
    rec RECORD;
BEGIN
    -- Drop all policies on members table
    FOR rec IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'members' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || rec.policyname || '" ON public.members';
    END LOOP;
    
    -- Drop all policies on activities table
    FOR rec IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'activities' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || rec.policyname || '" ON public.activities';
    END LOOP;
    
    -- Drop all policies on organizations table
    FOR rec IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'organizations' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || rec.policyname || '" ON public.organizations';
    END LOOP;
    
    -- Drop all policies on jobs table
    FOR rec IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'jobs' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || rec.policyname || '" ON public.jobs';
    END LOOP;
END $$;

-- Step 2: Update helper functions to be completely non-recursive
CREATE OR REPLACE FUNCTION public.get_user_member_data()
RETURNS TABLE(user_type text, member_role text, organization_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN QUERY SELECT 'guest'::text, null::text, null::uuid;
    RETURN;
  END IF;
  
  -- Direct query without RLS to avoid recursion
  RETURN QUERY
  EXECUTE 'SELECT 
    COALESCE(m.user_type::text, ''guest'') as user_type,
    m.member_role::text as member_role,
    m.organization_id
  FROM public.members m
  WHERE m.user_id = $1 
  LIMIT 1'
  USING current_user_id;
  
  -- If no member record found, return guest
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'guest'::text, null::text, null::uuid;
  END IF;
END;
$$;

-- Step 3: Create ultra-simple, non-recursive RLS policies

-- MEMBERS TABLE - Simple policies
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Users can see their own member record
CREATE POLICY "members_own_record" ON public.members
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Platform admins can do everything (check auth.users directly)
CREATE POLICY "members_platform_admin" ON public.members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'user_type' = 'platform_admin'
  )
);

-- ACTIVITIES TABLE - Simple policies
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Users can manage their own activities
CREATE POLICY "activities_own" ON public.activities
FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Platform admins can do everything
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

-- ORGANIZATIONS TABLE - Simple policies
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Platform admins can do everything
CREATE POLICY "organizations_platform_admin" ON public.organizations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'user_type' = 'platform_admin'
  )
);

-- Workspace owners can view their own organization
CREATE POLICY "organizations_workspace_owner" ON public.organizations
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'user_type' = 'workspace_owner'
  )
);

-- JOBS TABLE - Simple policies
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Platform admins can do everything
CREATE POLICY "jobs_platform_admin" ON public.jobs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'user_type' = 'platform_admin'
  )
);

-- Users can view jobs they're assigned to
CREATE POLICY "jobs_assigned_users" ON public.jobs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_assignments 
    WHERE job_assignments.job_id = jobs.id 
    AND job_assignments.user_id = auth.uid()
  )
);

-- Step 4: Ensure profiles table has proper policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_own" ON public.profiles;
CREATE POLICY "profiles_own" ON public.profiles
FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'EMERGENCY RECOVERY COMPLETE: All RLS policies have been rebuilt with non-recursive implementations.';
END $$;
