-- Fix member insertion RLS to allow platform admins, workspace owners, AND admins to invite members
-- This resolves the "new row violates row-level security policy" error

CREATE OR REPLACE FUNCTION public.user_can_manage_org_members(org_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  current_user_id uuid;
  org_tenant_id uuid;
  can_manage boolean;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get the tenant_id for the target organization
  SELECT tenant_id INTO org_tenant_id
  FROM public.organizations
  WHERE id = org_id_param;
  
  IF org_tenant_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Bypass RLS to check if user is platform admin, workspace owner, OR admin in that tenant
  SET LOCAL row_security = off;
  
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = current_user_id
      AND m.tenant_id = org_tenant_id
      AND m.user_status = 'active'
      AND (
        m.user_type = 'platform_admin'
        OR m.user_type = 'workspace_owner' 
        OR m.member_role = 'admin'
      )
  ) INTO can_manage;
  
  SET LOCAL row_security = on;
  
  RETURN can_manage;
END;
$$;