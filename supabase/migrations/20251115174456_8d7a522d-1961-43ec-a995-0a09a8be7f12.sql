-- Fix RLS recursion in security definer functions
-- These functions are called during RLS policy evaluation and were causing
-- infinite recursion when querying members/organizations tables

-- 1. Fix user_has_org_hierarchy_access (no parameters changed)
CREATE OR REPLACE FUNCTION public.user_has_org_hierarchy_access(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  current_user_id uuid;
  member_org_id uuid;
  org_tree_ids uuid[];
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Bypass RLS to prevent recursion
  SET LOCAL row_security = off;
  
  -- Check each organization the user is a member of
  FOR member_org_id IN 
    SELECT organization_id 
    FROM public.members 
    WHERE user_id = current_user_id 
      AND user_status = 'active'
  LOOP
    -- Get the full organization tree for this membership
    SELECT ARRAY_AGG(id) INTO org_tree_ids
    FROM (
      SELECT member_org_id as id
      UNION
      SELECT parent_organization_id as id
      FROM public.organizations
      WHERE id = member_org_id
        AND parent_organization_id IS NOT NULL
      UNION
      SELECT o.id
      FROM public.organizations o
      WHERE o.parent_organization_id = (
        SELECT parent_organization_id 
        FROM public.organizations 
        WHERE id = member_org_id
      )
      AND o.parent_organization_id IS NOT NULL
      UNION
      SELECT o.id
      FROM public.organizations o
      WHERE o.parent_organization_id = member_org_id
    ) tree;
    
    IF target_org_id = ANY(org_tree_ids) THEN
      SET LOCAL row_security = on;
      RETURN true;
    END IF;
  END LOOP;
  
  SET LOCAL row_security = on;
  RETURN false;
END;
$$;

-- 2. Fix check_org_hierarchy_role_access (takes text not member_role)
CREATE OR REPLACE FUNCTION public.check_org_hierarchy_role_access(_organization_id uuid, _required_role text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public
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
  
  -- Bypass RLS to prevent recursion
  SET LOCAL row_security = off;
  
  -- Get user's organization and role from members table
  SELECT organization_id, member_role::text INTO user_org_id, user_role
  FROM public.members
  WHERE user_id = current_user_id
    AND user_status = 'active'
  LIMIT 1;
  
  SET LOCAL row_security = on;
  
  IF user_org_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get user's organization and role from members table
  SET LOCAL row_security = off;
  
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
  
  SET LOCAL row_security = on;
  
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

-- 3. Fix check_org_member_access (has default parameter)
CREATE OR REPLACE FUNCTION public.check_org_member_access(_organization_id uuid, _required_role member_role DEFAULT NULL::member_role)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_org_id uuid;
  user_role public.member_role;
  user_is_platform_admin boolean;
BEGIN
  -- Check if user is platform admin first
  SELECT 
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'user_type') = 'platform_admin', false)
  INTO user_is_platform_admin;

  -- Platform admins bypass all org checks
  IF user_is_platform_admin THEN
    RETURN true;
  END IF;

  -- Bypass RLS to prevent recursion
  SET LOCAL row_security = off;

  -- Get user's organization and role
  SELECT m.organization_id, m.member_role::public.member_role
  INTO user_org_id, user_role
  FROM public.members m
  WHERE m.user_id = auth.uid()
    AND m.user_status = 'active'
  LIMIT 1;

  SET LOCAL row_security = on;

  -- Check if user belongs to the organization
  IF user_org_id IS NULL OR user_org_id != _organization_id THEN
    RETURN false;
  END IF;

  -- If no specific role required, just being in the org is enough
  IF _required_role IS NULL THEN
    RETURN true;
  END IF;

  -- Check if user has the required role
  RETURN user_role = _required_role;
END;
$$;