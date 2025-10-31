-- Improve hierarchy-aware access helpers for recruiters and admins

-- ========================================
-- Helper: user_has_org_hierarchy_access
-- ========================================
CREATE OR REPLACE FUNCTION public.user_has_org_hierarchy_access(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL OR target_org_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = current_user_id
      AND m.user_status = 'active'
      AND (
        m.organization_id = target_org_id
        OR m.organization_id IN (
          SELECT id FROM public.get_org_hierarchy(target_org_id)
        )
        OR target_org_id IN (
          SELECT id FROM public.get_org_hierarchy(m.organization_id)
        )
        OR EXISTS (
          WITH RECURSIVE membership_lineage AS (
            SELECT o.id, o.parent_organization_id
            FROM public.organizations o
            WHERE o.id = m.organization_id

            UNION ALL

            SELECT parent.id, parent.parent_organization_id
            FROM public.organizations parent
            JOIN membership_lineage child ON child.parent_organization_id = parent.id
          ),
          target_lineage AS (
            SELECT o.id, o.parent_organization_id
            FROM public.organizations o
            WHERE o.id = target_org_id

            UNION ALL

            SELECT parent.id, parent.parent_organization_id
            FROM public.organizations parent
            JOIN target_lineage child ON child.parent_organization_id = parent.id
          )
          SELECT 1
          FROM membership_lineage ml
          JOIN target_lineage tl ON tl.id = ml.id
          LIMIT 1
        )
      )
  );
END;
$$;

COMMENT ON FUNCTION public.user_has_org_hierarchy_access IS
'Checks if user has access to an organization based on active memberships and hierarchy-aware reachability.';

-- ========================================
-- Helper: check_org_member_access
-- ========================================
CREATE OR REPLACE FUNCTION public.check_org_member_access(
  _organization_id uuid,
  _required_role public.member_role DEFAULT NULL::public.member_role
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL OR _organization_id IS NULL THEN
    RETURN false;
  END IF;

  -- Platform admins still bypass org membership checks
  IF get_user_type_secure() = 'platform_admin' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = current_user_id
      AND m.user_status = 'active'
      AND (
        m.organization_id = _organization_id
        OR m.organization_id IN (
          SELECT id FROM public.get_org_hierarchy(_organization_id)
        )
        OR _organization_id IN (
          SELECT id FROM public.get_org_hierarchy(m.organization_id)
        )
        OR EXISTS (
          WITH RECURSIVE membership_lineage AS (
            SELECT o.id, o.parent_organization_id
            FROM public.organizations o
            WHERE o.id = m.organization_id

            UNION ALL

            SELECT parent.id, parent.parent_organization_id
            FROM public.organizations parent
            JOIN membership_lineage child ON child.parent_organization_id = parent.id
          ),
          target_lineage AS (
            SELECT o.id, o.parent_organization_id
            FROM public.organizations o
            WHERE o.id = _organization_id

            UNION ALL

            SELECT parent.id, parent.parent_organization_id
            FROM public.organizations parent
            JOIN target_lineage child ON child.parent_organization_id = parent.id
          )
          SELECT 1
          FROM membership_lineage ml
          JOIN target_lineage tl ON tl.id = ml.id
          LIMIT 1
        )
      )
      AND (
        _required_role IS NULL
        OR m.user_type = 'workspace_owner'
        OR m.member_role = _required_role
        OR (
          _required_role = 'recruiter'::public.member_role
          AND m.member_role = 'admin'::public.member_role
        )
        OR (
          _required_role = 'admin'::public.member_role
          AND m.user_type = 'workspace_owner'
        )
        OR (
          _required_role = 'recruiter'::public.member_role
          AND m.user_type = 'workspace_owner'
        )
      )
  );
END;
$function$;

COMMENT ON FUNCTION public.check_org_member_access IS 'Checks if the current user has hierarchy-aware membership access to an organization with optional role escalation support for admins and workspace owners.';
