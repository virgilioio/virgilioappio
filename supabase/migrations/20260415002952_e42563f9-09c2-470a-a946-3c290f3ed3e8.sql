
-- Fix get_user_type_secure: remove raw_user_meta_data shortcut
CREATE OR REPLACE FUNCTION public.get_user_type_secure()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_type_result text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 'guest';
  END IF;
  
  -- Query members table directly (SECURITY DEFINER bypasses RLS)
  SELECT COALESCE(user_type::text, 'guest') INTO user_type_result
  FROM public.members 
  WHERE user_id = current_user_id 
    AND user_status = 'active'
  ORDER BY 
    CASE WHEN user_type = 'platform_admin' THEN 1 ELSE 2 END,
    created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$$;

-- Fix get_user_type: remove JWT metadata shortcut
CREATE OR REPLACE FUNCTION public.get_user_type()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_type_result text;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN 'guest';
  END IF;
  
  -- Query members table directly (SECURITY DEFINER bypasses RLS)
  SELECT COALESCE(user_type::text, 'guest') INTO user_type_result
  FROM public.members 
  WHERE user_id = current_user_id
    AND user_status = 'active'
  ORDER BY
    CASE WHEN user_type = 'platform_admin' THEN 1 ELSE 2 END,
    created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(user_type_result, 'guest');
END;
$$;

-- Fix check_tenant_member_role: remove raw_user_meta_data shortcut
CREATE OR REPLACE FUNCTION public.check_tenant_member_role(tenant_id_param uuid, required_role text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check platform_admin from members table only
  IF EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = auth.uid()
      AND user_type = 'platform_admin'
      AND user_status = 'active'
  ) THEN
    RETURN true;
  END IF;

  IF required_role = 'recruiter' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.tenant_id = tenant_id_param AND m.user_status = 'active'
        AND (m.user_type = 'workspace_owner' OR m.system_role IN ('admin', 'member'))
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = auth.uid() AND m.tenant_id = tenant_id_param AND m.user_status = 'active'
        AND (m.user_type = 'workspace_owner' OR m.system_role = 'admin')
    );
  END IF;
END;
$$;
