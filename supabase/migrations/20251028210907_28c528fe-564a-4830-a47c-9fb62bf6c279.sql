-- Comprehensive Organization Hierarchy Access Control Fix
-- This migration updates the core access control function and critical RLS policies
-- to properly support parent-child organization hierarchies

-- ============================================================================
-- PART 1: Update check_org_member_access() to be hierarchy-aware
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_org_member_access(
  _organization_id uuid,
  _required_role member_role DEFAULT NULL::member_role
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  member_found boolean;
BEGIN
  -- Platform admins always have access
  IF get_user_type_secure() = 'platform_admin' THEN
    RETURN true;
  END IF;
  
  -- Check if user has access to this org through hierarchy
  -- This supports: direct membership, parent org access, or child org access
  IF user_has_org_hierarchy_access(_organization_id) THEN
    -- If no specific role required, any hierarchy access passes
    IF _required_role IS NULL THEN
      RETURN true;
    END IF;
    
    -- Check if user meets the role requirement in ANY org in the hierarchy
    SELECT EXISTS (
      SELECT 1
      FROM public.members m
      INNER JOIN public.organizations o ON o.id = m.organization_id
      WHERE m.user_id = auth.uid()
        AND m.user_status = 'active'
        -- Check if member's org is in the hierarchy of target org
        AND (
          m.organization_id = _organization_id
          OR m.organization_id IN (
            SELECT id FROM public.get_org_hierarchy(_organization_id)
          )
          OR _organization_id IN (
            SELECT id FROM public.get_org_hierarchy(m.organization_id)
          )
        )
        AND (
          -- Workspace owners have full access regardless of role requirement
          m.user_type = 'workspace_owner'
          -- Check for exact role match
          OR m.member_role = _required_role
          -- Admins can perform recruiter actions
          OR (_required_role = 'recruiter' AND m.member_role = 'admin')
        )
    ) INTO member_found;
    
    RETURN member_found;
  END IF;
  
  RETURN false;
END;
$function$;

-- ============================================================================
-- PART 2: Update jobs table RLS policies to support hierarchy
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view jobs in their organization" ON public.jobs;
DROP POLICY IF EXISTS "Users can insert jobs in their organization" ON public.jobs;
DROP POLICY IF EXISTS "Users can update jobs in their organization" ON public.jobs;
DROP POLICY IF EXISTS "Users can delete jobs in their organization" ON public.jobs;
DROP POLICY IF EXISTS "Platform admins can manage all jobs" ON public.jobs;

-- SELECT: Users can view jobs in their org hierarchy OR jobs they're assigned to
CREATE POLICY "Users can view jobs in their organization"
ON public.jobs
FOR SELECT
USING (
  get_user_type_secure() = 'platform_admin'
  OR is_user_assigned_to_job(id)
  OR user_has_org_hierarchy_access(organization_id)
);

-- INSERT: Users can create jobs in orgs they have access to
CREATE POLICY "Users can insert jobs in their organization"
ON public.jobs
FOR INSERT
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR user_has_org_hierarchy_access(organization_id)
);

-- UPDATE: Users can update jobs in orgs they have hierarchy access to
CREATE POLICY "Users can update jobs in their organization"
ON public.jobs
FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  OR is_user_assigned_to_job(id)
  OR user_has_org_hierarchy_access(organization_id)
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR is_user_assigned_to_job(id)
  OR user_has_org_hierarchy_access(organization_id)
);

-- DELETE: Users can delete jobs in orgs they have hierarchy access to
CREATE POLICY "Users can delete jobs in their organization"
ON public.jobs
FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  OR user_has_org_hierarchy_access(organization_id)
);

-- Platform admins policy for completeness
CREATE POLICY "Platform admins can manage all jobs"
ON public.jobs
FOR ALL
USING (get_user_type_secure() = 'platform_admin');

-- ============================================================================
-- PART 3: Update candidates table RLS policies to support hierarchy
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view candidates in their organization" ON public.candidates;
DROP POLICY IF EXISTS "Users can insert candidates in their organization" ON public.candidates;
DROP POLICY IF EXISTS "Users can update candidates in their organization" ON public.candidates;
DROP POLICY IF EXISTS "Users can delete candidates in their organization" ON public.candidates;
DROP POLICY IF EXISTS "Platform admins can manage all candidates" ON public.candidates;

-- SELECT: Users can view candidates in their org hierarchy
CREATE POLICY "Users can view candidates in their organization"
ON public.candidates
FOR SELECT
USING (
  get_user_type_secure() = 'platform_admin'
  OR user_has_org_hierarchy_access(organization_id)
);

-- INSERT: Users can create candidates in orgs they have access to
CREATE POLICY "Users can insert candidates in their organization"
ON public.candidates
FOR INSERT
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR user_has_org_hierarchy_access(organization_id)
);

-- UPDATE: Users can update candidates in orgs they have hierarchy access to
CREATE POLICY "Users can update candidates in their organization"
ON public.candidates
FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  OR user_has_org_hierarchy_access(organization_id)
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR user_has_org_hierarchy_access(organization_id)
);

-- DELETE: Users can delete candidates in orgs they have hierarchy access to
CREATE POLICY "Users can delete candidates in their organization"
ON public.candidates
FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  OR user_has_org_hierarchy_access(organization_id)
);

-- Platform admins policy for completeness
CREATE POLICY "Platform admins can manage all candidates"
ON public.candidates
FOR ALL
USING (get_user_type_secure() = 'platform_admin');