CREATE OR REPLACE FUNCTION public.user_is_crm_admin_in_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = _tenant_id
      AND m.user_status = 'active'
      AND (
        m.user_type IN ('platform_admin', 'workspace_owner')
        OR m.system_role IN ('admin', 'sales')
      )
  );
$$;