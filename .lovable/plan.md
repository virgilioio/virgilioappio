

# Fix Job Creation RLS Error for Workspace Owners

## Root Cause

The `check_org_hierarchy_role_access` function queries the `organizations` table directly to resolve parent/child relationships. Despite being `SECURITY DEFINER`, this triggers RLS evaluation errors on the `organizations` table during PostgREST's INSERT...RETURNING flow.

Meanwhile, `user_is_workspace_owner` works fine because it uses **tenant-based matching** (`members.tenant_id = organizations.tenant_id`) instead of querying organization hierarchy.

There's also a legacy `jobs_insert_by_org_roles` policy that only matches direct org membership (not child orgs), so it fails for workspace owners inserting jobs into child departments.

## Who should be able to create jobs

Per the approved permissions model:
- **Platform admins** — yes (any org)
- **Workspace owners** — yes (their tenant)
- **Admins** (system_role = 'admin') — yes (their tenant)
- **Regular members** — no (unless assigned recruiter role, but that's job-level, not creation-level)

## Fix: One Migration

### 1. Replace `check_org_hierarchy_role_access` with tenant-based logic

Rewrite the function to use the same safe pattern as `user_is_workspace_owner` — join `members` to `organizations` via `tenant_id` instead of querying `organizations` for parent IDs:

```sql
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
        -- workspace_owner and platform_admin always pass
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
```

This eliminates all direct `organizations` queries that trigger RLS recursion.

### 2. Drop legacy `jobs_insert_by_org_roles` policy

This policy only matches direct org membership and doesn't support child departments. It's redundant with `jobs_insert_consolidated` and causes confusion.

### 3. No changes needed to `jobs_insert_consolidated`, `jobs_select_consolidated`, or `jobs_update_consolidated`

They already call `check_org_hierarchy_role_access` — once that function is fixed, they'll all work correctly.

### 4. No frontend changes needed

## Scope
- 1 database migration
- 0 frontend files changed

