-- Fix check_org_member_access to properly support parent → child organization access
-- This migration adds explicit child organization checks to the function

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
    -- NOW with proper child organization support
    SELECT EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.user_id = auth.uid()
        AND m.user_status = 'active'
        -- Check if member's org gives them access to target org
        AND (
          -- Direct membership in target org
          m.organization_id = _organization_id
          
          -- Member's org is in the hierarchy of target org (upward traversal)
          OR m.organization_id IN (
            SELECT id FROM public.get_org_hierarchy(_organization_id)
          )
          
          -- Target org is in the hierarchy of member's org (downward traversal)
          OR _organization_id IN (
            SELECT id FROM public.get_org_hierarchy(m.organization_id)
          )
          
          -- ✅ ADDED: Target org is a direct child of member's org
          OR EXISTS (
            SELECT 1 
            FROM public.organizations o
            WHERE o.id = _organization_id 
              AND o.parent_organization_id = m.organization_id
          )
          
          -- ✅ ADDED: Target org is a grandchild (child of child) of member's org
          OR EXISTS (
            SELECT 1
            FROM public.organizations o1
            INNER JOIN public.organizations o2 ON o2.id = o1.parent_organization_id
            WHERE o1.id = _organization_id
              AND o2.parent_organization_id = m.organization_id
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

-- Add comment explaining the fix
COMMENT ON FUNCTION public.check_org_member_access(uuid, member_role) IS 
'Checks if the authenticated user has access to an organization with an optional role requirement. 
Supports full organization hierarchies including parent → child relationships.
Workspace owners of parent orgs have access to all child orgs.';