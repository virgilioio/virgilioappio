

# Fix: Sourcing Projects Not Loading (RLS Infinite Recursion)

## Root Cause

The collaborative sourcing migration introduced **circular RLS** between two tables:

```text
sourcing_projects SELECT policy
  └─ EXISTS (SELECT 1 FROM sourcing_project_collaborators ...)
        └─ sourcing_project_collaborators SELECT policy ("Project creators can view collaborators")
              └─ EXISTS (SELECT 1 FROM sourcing_projects ...)
                    └─ ∞ infinite recursion
```

Postgres detects this and raises "infinite recursion detected in policy", which causes all sourcing project queries to fail.

**Secondary bug:** The `id` reference in the collaborators EXISTS clause resolved to `spc.id` instead of `sourcing_projects.id` (column ambiguity).

## Fix — 1 migration

### 1. Create a SECURITY DEFINER function to break the cycle

A function that checks if a user is the creator of a sourcing project, bypassing RLS:

```sql
CREATE OR REPLACE FUNCTION public.is_sourcing_project_creator(
  _project_id UUID, _user_id UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sourcing_projects
    WHERE id = _project_id AND created_by = _user_id
  );
$$;
```

### 2. Recreate collaborators SELECT policy using the function

Replace the "Project creators can view collaborators" policy to use the SECURITY DEFINER function instead of a direct subquery:

```sql
DROP POLICY "Project creators can view collaborators"
  ON sourcing_project_collaborators;

CREATE POLICY "Project creators can view collaborators"
  ON sourcing_project_collaborators FOR SELECT
  USING (
    is_sourcing_project_creator(sourcing_project_id, auth.uid())
  );
```

### 3. Fix the ambiguous `id` in sourcing_projects policies

Recreate the SELECT and UPDATE policies with explicit table-qualified references:

```sql
-- Fix SELECT
DROP POLICY "Users can view own, public, or collaborated projects"
  ON sourcing_projects;

CREATE POLICY "Users can view own, public, or collaborated projects"
  ON sourcing_projects FOR SELECT
  USING (
    created_by = auth.uid()
    OR (is_public = true AND user_has_org_hierarchy_access(organization_id))
    OR get_user_type_secure() = 'platform_admin'
    OR EXISTS (
      SELECT 1 FROM sourcing_project_collaborators spc
      WHERE spc.sourcing_project_id = sourcing_projects.id
        AND spc.user_id = auth.uid()
    )
  );

-- Fix UPDATE
DROP POLICY "Users can update own or collaborated projects"
  ON sourcing_projects;

CREATE POLICY "Users can update own or collaborated projects"
  ON sourcing_projects FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sourcing_project_collaborators spc
      WHERE spc.sourcing_project_id = sourcing_projects.id
        AND spc.user_id = auth.uid()
    )
  );
```

### 4. Also fix INSERT/DELETE policies on collaborators table

The INSERT and DELETE policies on `sourcing_project_collaborators` also reference `sourcing_projects` directly — use the same SECURITY DEFINER function:

```sql
DROP POLICY "Project creators can add collaborators" ON sourcing_project_collaborators;
CREATE POLICY "Project creators can add collaborators"
  ON sourcing_project_collaborators FOR INSERT
  WITH CHECK (
    added_by = auth.uid()
    AND is_sourcing_project_creator(sourcing_project_id, auth.uid())
  );

DROP POLICY "Project creators can remove collaborators" ON sourcing_project_collaborators;
CREATE POLICY "Project creators can remove collaborators"
  ON sourcing_project_collaborators FOR DELETE
  USING (is_sourcing_project_creator(sourcing_project_id, auth.uid()));
```

## Scope
- 1 database migration
- No code changes needed

