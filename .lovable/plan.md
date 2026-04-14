

# Fix Job Creation: Drop the Broken CHECK Constraint

## Root Cause (confirmed live)

Claude's analysis is 100% correct. The real problem was never the RLS policies — it's a **CHECK constraint** on the `jobs` table:

```sql
CHECK (is_child_organization(organization_id))
```

The helper `is_child_organization(org_id)` is:
- **NOT** `SECURITY DEFINER` — runs as the caller
- Queries `organizations` directly — subject to RLS
- PostgreSQL refuses to evaluate a CHECK whose subquery crosses an RLS boundary for non-superusers → raises `42501`

The trigger `jobs_before_insert` already enforces the identical rule (`parent_organization_id IS NULL → raise exception`) and IS `SECURITY DEFINER`, so it works fine.

All previous patches (rewriting `check_org_hierarchy_role_access`, `user_is_member_of_org_hierarchy`, `organizations_select_consolidated`) were fixing the wrong thing.

## Fix: One Migration, Two Statements

```sql
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_must_reference_child_org;
DROP FUNCTION IF EXISTS public.is_child_organization(uuid);
```

That's it. The trigger stays. No new code. No frontend changes.

## About Bug B (tenants with zero child orgs)

8 SaaS tenants have no child orgs. Even after this fix, the `jobs_before_insert` trigger will reject their inserts with error `23514` ("must reference a child organization"). This is a separate design decision — should we auto-create a default department during signup, or allow flat workspaces? We can address that as a follow-up once the immediate demo blocker is resolved.

## Scope
- 1 migration (2 SQL statements)
- 0 frontend files changed

