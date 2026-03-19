
-- Update resolve_org_context: return 'deactivated' for inactive members instead of 'guest'
CREATE OR REPLACE FUNCTION public.resolve_org_context()
RETURNS TABLE(organization_id uuid, role text, user_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN QUERY SELECT null::uuid, null::text, 'guest'::text; RETURN;
  END IF;
  -- Platform admin check
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = current_user_id AND (raw_user_meta_data->>'user_type') = 'platform_admin') THEN
    RETURN QUERY SELECT m.organization_id, COALESCE(m.system_role::text, 'admin'), 'platform_admin'::text
    FROM public.members m WHERE m.user_id = current_user_id AND m.user_status = 'active'
    ORDER BY CASE WHEN m.user_type = 'platform_admin' THEN 1 ELSE 2 END, m.created_at DESC LIMIT 1;
    IF NOT FOUND THEN RETURN QUERY SELECT null::uuid, 'admin'::text, 'platform_admin'::text; END IF;
    RETURN;
  END IF;
  -- Active member lookup
  RETURN QUERY SELECT m.organization_id, m.system_role::text, COALESCE(m.user_type::text, 'guest')
  FROM public.members m WHERE m.user_id = current_user_id AND m.user_status = 'active'
  ORDER BY m.created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    -- Check for inactive (deactivated) member
    IF EXISTS (SELECT 1 FROM public.members WHERE user_id = current_user_id AND user_status = 'inactive') THEN
      RETURN QUERY SELECT null::uuid, null::text, 'deactivated'::text;
    ELSE
      RETURN QUERY SELECT null::uuid, null::text, 'guest'::text;
    END IF;
  END IF;
END;
$$;

-- Also update get_user_member_data for consistency
CREATE OR REPLACE FUNCTION public.get_user_member_data()
RETURNS TABLE(user_type text, member_role text, organization_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN RETURN QUERY SELECT 'guest'::text, null::text, null::uuid; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = current_user_id AND (raw_user_meta_data->>'user_type') = 'platform_admin') THEN
    RETURN QUERY SELECT 'platform_admin'::text, COALESCE(m.system_role::text, 'admin'), m.organization_id
    FROM public.members m WHERE m.user_id = current_user_id AND m.user_status = 'active'
    ORDER BY CASE WHEN m.user_type = 'platform_admin' THEN 1 ELSE 2 END, m.created_at DESC LIMIT 1;
    IF NOT FOUND THEN RETURN QUERY SELECT 'platform_admin'::text, 'admin'::text, null::uuid; END IF;
    RETURN;
  END IF;
  RETURN QUERY SELECT COALESCE(m.user_type::text, 'guest'), m.system_role::text, m.organization_id
  FROM public.members m WHERE m.user_id = current_user_id AND m.user_status = 'active'
  ORDER BY m.created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.members WHERE user_id = current_user_id AND user_status = 'inactive') THEN
      RETURN QUERY SELECT 'deactivated'::text, null::text, null::uuid;
    ELSE
      RETURN QUERY SELECT 'guest'::text, null::text, null::uuid;
    END IF;
  END IF;
END;
$$;
