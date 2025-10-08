-- =====================================================
-- PHASE 1: CREATE SECURITY DEFINER FUNCTION
-- This prevents infinite recursion in RLS policies
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_org_member_access(
  _organization_id uuid,
  _required_role member_role DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_found boolean;
BEGIN
  -- Platform admins always have access
  IF get_user_type_secure() = 'platform_admin' THEN
    RETURN true;
  END IF;
  
  -- Check if user is an active member of the organization
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = _organization_id
      AND m.user_status = 'active'
      AND (
        -- Workspace owners have full access regardless of role requirement
        m.user_type = 'workspace_owner'
        -- If no specific role required, any active member passes
        OR _required_role IS NULL
        -- Check for exact role match
        OR m.member_role = _required_role
        -- Admins can perform recruiter actions
        OR (_required_role = 'recruiter' AND m.member_role = 'admin')
      )
  ) INTO member_found;
  
  RETURN member_found;
END;
$$;

-- =====================================================
-- PHASE 2: FIX MEMBERS TABLE RLS POLICIES
-- Replace all recursive policies with security definer function
-- =====================================================

-- Drop ALL existing policies on members table
DROP POLICY IF EXISTS "Platform admins can manage all members - secure" ON public.members;
DROP POLICY IF EXISTS "Workspace owners and admins can invite members" ON public.members;
DROP POLICY IF EXISTS "Workspace owners and admins can update members" ON public.members;
DROP POLICY IF EXISTS "Workspace owners and admins can view members" ON public.members;
DROP POLICY IF EXISTS "members_own_record" ON public.members;

-- Create new non-recursive policies using security definer function

-- Platform admins can do everything
CREATE POLICY "Platform admins can manage all members"
ON public.members FOR ALL
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

-- Users can view their own member record
CREATE POLICY "Users can view own member record"
ON public.members FOR SELECT
USING (user_id = auth.uid());

-- Workspace owners and org admins can view members in their org
CREATE POLICY "Org admins can view org members"
ON public.members FOR SELECT
USING (
  check_org_member_access(organization_id, 'admin')
  OR user_type = 'workspace_owner' AND organization_id IN (
    SELECT m.organization_id FROM public.members m 
    WHERE m.user_id = auth.uid() AND m.user_type = 'workspace_owner'
  )
);

-- Workspace owners and org admins can invite members
CREATE POLICY "Org admins can invite members"
ON public.members FOR INSERT
WITH CHECK (
  check_org_member_access(organization_id, 'admin')
  OR user_type = 'workspace_owner' AND organization_id IN (
    SELECT m.organization_id FROM public.members m 
    WHERE m.user_id = auth.uid() AND m.user_type = 'workspace_owner'
  )
);

-- Workspace owners and org admins can update members
CREATE POLICY "Org admins can update members"
ON public.members FOR UPDATE
USING (
  check_org_member_access(organization_id, 'admin')
  OR user_type = 'workspace_owner' AND organization_id IN (
    SELECT m.organization_id FROM public.members m 
    WHERE m.user_id = auth.uid() AND m.user_type = 'workspace_owner'
  )
)
WITH CHECK (
  check_org_member_access(organization_id, 'admin')
  OR user_type = 'workspace_owner' AND organization_id IN (
    SELECT m.organization_id FROM public.members m 
    WHERE m.user_id = auth.uid() AND m.user_type = 'workspace_owner'
  )
);

-- =====================================================
-- PHASE 3: FIX OTHER TABLE RLS POLICIES
-- Update candidates, jobs, organizations, etc.
-- =====================================================

-- CANDIDATES TABLE
DROP POLICY IF EXISTS "Organization members can view org candidates" ON public.candidates;
DROP POLICY IF EXISTS "Organization recruiters can create candidates" ON public.candidates;
DROP POLICY IF EXISTS "Organization recruiters can update org candidates" ON public.candidates;
DROP POLICY IF EXISTS "Organization admins can delete org candidates" ON public.candidates;

CREATE POLICY "Org members can view org candidates"
ON public.candidates FOR SELECT
USING (
  get_user_type_secure() = 'platform_admin'
  OR (organization_id IS NOT NULL AND check_org_member_access(organization_id))
);

CREATE POLICY "Org recruiters can create candidates"
ON public.candidates FOR INSERT
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR (
    organization_id IS NOT NULL 
    AND check_org_member_access(organization_id, 'recruiter')
    AND created_by = auth.uid()
  )
);

CREATE POLICY "Org recruiters can update candidates"
ON public.candidates FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  OR (organization_id IS NOT NULL AND check_org_member_access(organization_id, 'recruiter'))
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR (organization_id IS NOT NULL AND check_org_member_access(organization_id, 'recruiter'))
);

CREATE POLICY "Org admins can delete candidates"
ON public.candidates FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  OR (organization_id IS NOT NULL AND check_org_member_access(organization_id, 'admin'))
);

-- JOBS TABLE
DROP POLICY IF EXISTS "Organization members can view their jobs" ON public.jobs;
DROP POLICY IF EXISTS "Organization admins and recruiters can create jobs" ON public.jobs;

CREATE POLICY "Org members can view org jobs"
ON public.jobs FOR SELECT
USING (check_org_member_access(organization_id));

CREATE POLICY "Org recruiters can create jobs"
ON public.jobs FOR INSERT
WITH CHECK (check_org_member_access(organization_id, 'recruiter'));

-- ORGANIZATIONS TABLE
DROP POLICY IF EXISTS "Platform admins can manage all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Workspace owners can manage their organization" ON public.organizations;
DROP POLICY IF EXISTS "Organization members can view their organization" ON public.organizations;

CREATE POLICY "Platform admins can manage orgs"
ON public.organizations FOR ALL
USING (get_user_type_secure() = 'platform_admin')
WITH CHECK (get_user_type_secure() = 'platform_admin');

CREATE POLICY "Workspace owners can manage own org"
ON public.organizations FOR UPDATE
USING (check_org_member_access(id))
WITH CHECK (check_org_member_access(id));

CREATE POLICY "Org members can view own org"
ON public.organizations FOR SELECT
USING (check_org_member_access(id));

-- JOB ASSIGNMENTS TABLE
DROP POLICY IF EXISTS "Organization members can view assignments in their org" ON public.job_assignments;

CREATE POLICY "Org members can view assignments"
ON public.job_assignments FOR SELECT
USING (check_org_member_access(organization_id));

-- ACTIVITIES TABLE  
DROP POLICY IF EXISTS "Users can view activities in their organization" ON public.activities;

CREATE POLICY "Users can view org activities"
ON public.activities FOR SELECT
USING (
  user_id = auth.uid()
  OR (organization_id IS NOT NULL AND check_org_member_access(organization_id))
);

-- =====================================================
-- PHASE 4: FIX VIRGILIO TEAM DATA
-- Correct member roles for Virgilio team
-- =====================================================

-- Fix fjrodriguez@virgilio.tech: platform_admin/admin -> member/recruiter
UPDATE public.members
SET 
  user_type = 'member'::user_type_enum,
  member_role = 'recruiter'::member_role,
  updated_at = now()
WHERE invited_email = 'fjrodriguez@virgilio.tech'
  AND organization_id = '5ba7b145-f251-4b18-8900-724cb06028ab';

-- Fix mauricio@virgilio.tech: platform_admin/admin -> member/recruiter
UPDATE public.members
SET 
  user_type = 'member'::user_type_enum,
  member_role = 'recruiter'::member_role,
  updated_at = now()
WHERE invited_email = 'mauricio@virgilio.tech'
  AND organization_id = '5ba7b145-f251-4b18-8900-724cb06028ab';

-- Fix success@virgilio.tech: platform_admin/admin -> member/recruiter
UPDATE public.members
SET 
  user_type = 'member'::user_type_enum,
  member_role = 'recruiter'::member_role,
  updated_at = now()
WHERE invited_email = 'success@virgilio.tech'
  AND organization_id = '5ba7b145-f251-4b18-8900-724cb06028ab';

-- Delete orphaned invite for victoria@virgilio.tech
DELETE FROM public.members
WHERE invited_email = 'victoria@virgilio.tech'
  AND user_id IS NULL
  AND user_status = 'invited';

-- =====================================================
-- PHASE 5: SYNC AUTH METADATA
-- Update auth.users.raw_user_meta_data to match members table
-- =====================================================

-- Update auth metadata for the 3 fixed Virgilio members
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{user_type}',
  '"member"'
)
WHERE email IN (
  'fjrodriguez@virgilio.tech',
  'mauricio@virgilio.tech', 
  'success@virgilio.tech'
);