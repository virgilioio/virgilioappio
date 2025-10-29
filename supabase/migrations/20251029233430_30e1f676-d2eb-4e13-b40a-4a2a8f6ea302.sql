-- ============================================================
-- Fix: Force Postgres to Recognize member_role Type
-- ============================================================
-- This migration refreshes the check_org_member_access function
-- to ensure Postgres properly recognizes the member_role type
-- during RLS policy evaluation by recreating it

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
  IF user_has_org_hierarchy_access(_organization_id) THEN
    -- If no specific role required, any hierarchy access passes
    IF _required_role IS NULL THEN
      RETURN true;
    END IF;
    
    -- Check if user meets the role requirement in ANY org in the hierarchy
    SELECT EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.user_status = 'active'
        AND (
          -- Direct membership in target org
          m.organization_id = _organization_id
          
          -- Member's org is in the hierarchy of target org (upward)
          OR m.organization_id IN (
            SELECT id FROM public.get_org_hierarchy(_organization_id)
          )
          
          -- Target org is in the hierarchy of member's org (downward)
          OR _organization_id IN (
            SELECT id FROM public.get_org_hierarchy(m.organization_id)
          )
          
          -- Target org is a direct child of member's org
          OR EXISTS (
            SELECT 1 
            FROM public.organizations o
            WHERE o.id = _organization_id 
              AND o.parent_organization_id = m.organization_id
          )
          
          -- Target org is a grandchild of member's org
          OR EXISTS (
            SELECT 1
            FROM public.organizations o1
            INNER JOIN public.organizations o2 ON o2.id = o1.parent_organization_id
            WHERE o1.id = _organization_id
              AND o2.parent_organization_id = m.organization_id
          )
        )
        AND (
          -- Workspace owners have full access
          m.user_type = 'workspace_owner'
          -- Exact role match
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