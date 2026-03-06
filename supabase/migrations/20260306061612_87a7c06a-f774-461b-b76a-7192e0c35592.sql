
-- Fix get_tenant_billable_seat_count to include recruiters from job_assignments
CREATE OR REPLACE FUNCTION public.get_tenant_billable_seat_count(tenant_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cnt integer;
BEGIN
  SELECT COUNT(DISTINCT m.user_id) INTO cnt
  FROM public.members m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE o.tenant_id = tenant_id_param
    AND m.user_status = 'active'
    AND m.user_type NOT IN ('platform_admin', 'guest')
    AND (
      m.user_type = 'workspace_owner'
      OR m.system_role = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.job_assignments ja
        WHERE ja.user_id = m.user_id
          AND ja.role = 'recruiter'
          AND ja.deleted_at IS NULL
      )
    );
  RETURN COALESCE(cnt, 0);
END;
$$;
