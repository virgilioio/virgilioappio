
-- 1. Replace check_org_hierarchy_role_access with tenant-based logic (no direct org hierarchy queries)
CREATE OR REPLACE FUNCTION public.check_org_hierarchy_role_access(
  _organization_id uuid, _required_role text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    JOIN public.organizations o ON m.tenant_id = o.tenant_id
    WHERE o.id = _organization_id
      AND m.user_id = auth.uid()
      AND m.user_status = 'active'
      AND (
        m.user_type IN ('workspace_owner', 'platform_admin')
        OR (
          CASE WHEN _required_role = 'admin'
            THEN m.system_role = 'admin'
            ELSE m.system_role IN ('admin', 'member')
          END
        )
      )
  )
$$;

-- 2. Drop legacy jobs_insert_by_org_roles policy (redundant, doesn't support child orgs)
DROP POLICY IF EXISTS "jobs_insert_by_org_roles" ON public.jobs;
