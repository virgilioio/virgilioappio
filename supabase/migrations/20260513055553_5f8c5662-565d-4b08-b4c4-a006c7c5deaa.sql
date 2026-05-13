-- Fix: "SET is not allowed in a non-volatile function"
-- These functions use SET LOCAL row_security / set_config inside,
-- which requires VOLATILE volatility.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM set_config('row_security', 'off', true);

  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = v_user_id
      AND m.user_status = 'active'
      AND m.user_type = 'platform_admin'
  )
  INTO v_is_admin;

  RETURN COALESCE(v_is_admin, false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_is_workspace_owner_in_tenant(tenant_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  current_user_id uuid;
  is_owner boolean;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  SET LOCAL row_security = off;

  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = current_user_id
      AND m.tenant_id = tenant_id_param
      AND m.user_status = 'active'
      AND m.user_type = 'workspace_owner'
  ) INTO is_owner;

  SET LOCAL row_security = on;

  RETURN is_owner;
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_has_org_hierarchy_access(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  member_org_id uuid;
  org_tree_ids uuid[];
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  SET LOCAL row_security = off;

  FOR member_org_id IN
    SELECT organization_id
    FROM public.members
    WHERE user_id = current_user_id
      AND user_status = 'active'
  LOOP
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
$function$;