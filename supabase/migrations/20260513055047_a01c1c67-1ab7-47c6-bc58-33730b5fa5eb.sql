CREATE OR REPLACE FUNCTION public.user_is_crm_admin_in_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR _tenant_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = v_uid
      AND m.tenant_id = _tenant_id
      AND m.user_status = 'active'
      AND (
        m.user_type IN ('platform_admin', 'workspace_owner')
        OR m.system_role IN ('admin', 'sales')
      )
  );
END;
$$;