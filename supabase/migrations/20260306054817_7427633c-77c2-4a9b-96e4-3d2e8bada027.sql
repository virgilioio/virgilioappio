CREATE OR REPLACE FUNCTION public.check_org_hierarchy_role_access(
  _organization_id uuid,
  _required_role text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  user_org_id uuid;
  user_role text;
  target_parent_id uuid;
  user_parent_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN RETURN false; END IF;

  SELECT organization_id, system_role::text INTO user_org_id, user_role
  FROM public.members
  WHERE user_id = current_user_id AND user_status = 'active'
  LIMIT 1;

  IF user_org_id IS NULL THEN RETURN false; END IF;

  IF user_org_id = _organization_id THEN
    IF _required_role = 'admin' THEN
      RETURN user_role = 'admin';
    ELSE
      RETURN user_role IN ('admin', 'member');
    END IF;
  END IF;

  SELECT parent_organization_id INTO target_parent_id
  FROM public.organizations WHERE id = _organization_id;

  SELECT parent_organization_id INTO user_parent_id
  FROM public.organizations WHERE id = user_org_id;

  IF user_org_id = target_parent_id
     OR (user_parent_id IS NOT NULL AND user_parent_id = target_parent_id)
     OR (target_parent_id IS NOT NULL AND target_parent_id = user_org_id) THEN
    IF _required_role = 'admin' THEN
      RETURN user_role = 'admin';
    ELSE
      RETURN user_role IN ('admin', 'member');
    END IF;
  END IF;

  RETURN false;
END;
$$;