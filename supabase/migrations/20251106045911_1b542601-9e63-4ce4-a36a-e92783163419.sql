-- ============================================================
-- PHASE 2: Add Database Constraints
-- Enforces business rules at database level to prevent violations
-- ============================================================

-- 1. Create trigger function to prevent members in child organizations
CREATE OR REPLACE FUNCTION public.validate_member_parent_org_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  is_child_org boolean;
BEGIN
  -- Check if the organization is a child org (has a parent)
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o 
    WHERE o.id = NEW.organization_id 
    AND o.parent_organization_id IS NOT NULL
  ) INTO is_child_org;
  
  IF is_child_org THEN
    RAISE EXCEPTION 'Members can only belong to parent organizations, not child organizations';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Add trigger to enforce parent-org-only rule for members
DROP TRIGGER IF EXISTS enforce_member_parent_org_only ON public.members;
CREATE TRIGGER enforce_member_parent_org_only
  BEFORE INSERT OR UPDATE OF organization_id ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_member_parent_org_only();

-- 3. Create trigger function to validate organization creation permissions
CREATE OR REPLACE FUNCTION public.validate_org_creation_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Platform admins can create any org
  IF get_user_type_secure() = 'platform_admin' THEN
    RETURN NEW;
  END IF;
  
  -- Workspace owners can only create child orgs under their parent
  IF NEW.parent_organization_id IS NOT NULL THEN
    IF NOT user_is_workspace_owner(NEW.parent_organization_id) THEN
      RAISE EXCEPTION 'Only workspace owners can create child organizations';
    END IF;
  ELSE
    -- Only platform admins can create parent orgs
    RAISE EXCEPTION 'Only platform admins can create parent organizations';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Add trigger to enforce organization creation permissions
DROP TRIGGER IF EXISTS enforce_org_creation_permissions ON public.organizations;
CREATE TRIGGER enforce_org_creation_permissions
  BEFORE INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_org_creation_permissions();

-- 5. Verify no NULL organization_ids exist in members table and make NOT NULL if clean
DO $$
DECLARE
  null_count integer;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM public.members
  WHERE organization_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE WARNING 'Found % members with NULL organization_id. These should be fixed before making organization_id NOT NULL.', null_count;
  ELSE
    -- Make organization_id NOT NULL since no NULLs exist
    ALTER TABLE public.members ALTER COLUMN organization_id SET NOT NULL;
    RAISE NOTICE 'Successfully set organization_id to NOT NULL on members table';
  END IF;
END $$;

COMMENT ON FUNCTION public.validate_member_parent_org_only IS 
'Ensures members can only belong to parent organizations, never to child organizations.';

COMMENT ON FUNCTION public.validate_org_creation_permissions IS 
'Enforces organization creation rules: platform admins can create any org, workspace owners can only create child orgs under their parent.';