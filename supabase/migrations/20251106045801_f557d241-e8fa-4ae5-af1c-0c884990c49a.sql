-- ============================================================
-- PHASE 1: Fix Critical Recruiter Bug
-- Creates new hierarchy-aware role access function and updates RLS policies
-- ============================================================

-- 1. Create new check_org_hierarchy_role_access function
-- This function properly handles parent→child organization hierarchy
CREATE OR REPLACE FUNCTION public.check_org_hierarchy_role_access(
  _organization_id uuid,
  _required_role text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  user_role text;
  org_tree_ids uuid[];
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get user's organization and role from members table
  SELECT organization_id, member_role::text INTO user_org_id, user_role
  FROM public.members
  WHERE user_id = current_user_id
    AND user_status = 'active'
  LIMIT 1;
  
  IF user_org_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Build organization tree: user's parent org + all its children
  SELECT ARRAY_AGG(id) INTO org_tree_ids
  FROM (
    -- User's own organization
    SELECT user_org_id as id
    
    UNION
    
    -- All child organizations of user's org
    SELECT o.id
    FROM public.organizations o
    WHERE o.parent_organization_id = user_org_id
  ) tree;
  
  -- Check if target organization is in user's hierarchy
  IF NOT (_organization_id = ANY(org_tree_ids)) THEN
    RETURN false;
  END IF;
  
  -- Check role hierarchy: admin inherits all roles, recruiter inherits hiring_manager + interviewer
  IF user_role = 'admin' THEN
    RETURN true; -- Admins have all permissions
  ELSIF user_role = 'recruiter' AND _required_role IN ('recruiter', 'hiring_manager', 'interviewer') THEN
    RETURN true;
  ELSIF user_role = 'hiring_manager' AND _required_role IN ('hiring_manager', 'interviewer') THEN
    RETURN true;
  ELSIF user_role = _required_role THEN
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- 2. Update jobs INSERT RLS policy
DROP POLICY IF EXISTS jobs_insert_consolidated ON public.jobs;
CREATE POLICY jobs_insert_consolidated ON public.jobs
FOR INSERT
WITH CHECK (
  -- Platform admins can insert anywhere
  get_user_type_secure() = 'platform_admin'
  OR
  -- Users with hierarchy access + recruiter role can insert
  check_org_hierarchy_role_access(organization_id, 'recruiter')
);

-- 3. Update jobs UPDATE RLS policy
DROP POLICY IF EXISTS jobs_update_consolidated ON public.jobs;
CREATE POLICY jobs_update_consolidated ON public.jobs
FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  OR
  check_org_hierarchy_role_access(organization_id, 'recruiter')
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR
  check_org_hierarchy_role_access(organization_id, 'recruiter')
);

-- 4. Update candidates INSERT RLS policy
DROP POLICY IF EXISTS candidates_insert_consolidated ON public.candidates;
CREATE POLICY candidates_insert_consolidated ON public.candidates
FOR INSERT
WITH CHECK (
  user_has_org_hierarchy_access(organization_id)
  AND (
    get_user_type_secure() = 'platform_admin'
    OR
    check_org_hierarchy_role_access(organization_id, 'recruiter')
  )
);

-- 5. Update candidates UPDATE RLS policy  
DROP POLICY IF EXISTS candidates_update_consolidated ON public.candidates;
CREATE POLICY candidates_update_consolidated ON public.candidates
FOR UPDATE
USING (
  user_has_org_hierarchy_access(organization_id)
  AND (
    get_user_type_secure() = 'platform_admin'
    OR
    check_org_hierarchy_role_access(organization_id, 'recruiter')
  )
)
WITH CHECK (
  user_has_org_hierarchy_access(organization_id)
  AND (
    get_user_type_secure() = 'platform_admin'
    OR
    check_org_hierarchy_role_access(organization_id, 'recruiter')
  )
);

COMMENT ON FUNCTION public.check_org_hierarchy_role_access IS 
'Checks if current user has required role within organization hierarchy (parent + children). Implements role hierarchy: admin > recruiter > hiring_manager > interviewer.';