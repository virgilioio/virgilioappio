-- Fix billable seat counting to use hybrid model:
-- 1. All workspace_owners are billable
-- 2. Members are billable only if they have admin or recruiter roles
-- 3. Platform admins and guests are never billable

CREATE OR REPLACE FUNCTION public.get_tenant_billable_seat_count(tenant_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $func$
DECLARE
  cnt integer;
BEGIN
  SELECT COUNT(DISTINCT m.user_id)
    INTO cnt
  FROM public.members m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE o.tenant_id = tenant_id_param
    AND m.user_status = 'active'
    AND m.user_type NOT IN ('platform_admin', 'guest')
    AND (
      -- All workspace owners are billable
      m.user_type = 'workspace_owner'
      OR 
      -- Members are billable only if they have premium roles
      (m.user_type = 'member' AND m.member_role IN ('admin', 'recruiter'))
    );
  
  RETURN COALESCE(cnt, 0);
END;
$func$;

-- Add helpful comment
COMMENT ON FUNCTION public.get_tenant_billable_seat_count(uuid) IS 
'Counts billable seats for a tenant. Billable users are: (1) all workspace_owner users regardless of role, (2) member users with admin or recruiter roles. Excludes platform_admin and guest users.';