

# Collaborative Sourcing Projects

## Problem
When you share a sourcing project URL with a teammate, it loads forever because the RLS SELECT policy only allows:
1. The **creator** (`created_by = auth.uid()`)
2. **Public** projects (`is_public = true`) — but all projects default to `is_public = false`

There's no concept of inviting collaborators to a specific project.

## Solution: Collaborators Table + Visibility Toggle

Two pieces:

### 1. Database: `sourcing_project_collaborators` table

A lightweight join table allowing the creator to add teammates:

```
sourcing_project_collaborators
├── id (UUID, PK)
├── sourcing_project_id (FK → sourcing_projects)
├── user_id (FK → auth.users)
├── added_by (FK → auth.users)
├── created_at
└── UNIQUE(sourcing_project_id, user_id)
```

RLS on this table: collaborators can view their own rows; project creator can INSERT/DELETE.

### 2. Database: Update sourcing_projects SELECT policy

Add a third condition — user is a collaborator:

```sql
DROP POLICY "Users can view own or public org projects" ON sourcing_projects;

CREATE POLICY "Users can view own, public, or collaborated projects"
  ON sourcing_projects FOR SELECT
  USING (
    created_by = auth.uid()
    OR (is_public = true AND user_has_org_hierarchy_access(organization_id))
    OR get_user_type_secure() = 'platform_admin'
    OR EXISTS (
      SELECT 1 FROM sourcing_project_collaborators spc
      WHERE spc.sourcing_project_id = id
        AND spc.user_id = auth.uid()
    )
  );
```

Also update the UPDATE policy so collaborators can update (not just the creator).

### 3. UI: Collaborator Management

In the `SourcingProjectView` header area (near the saved search selector), add a small **avatar group + invite button**:

- Shows the creator's avatar + any collaborator avatars (stacked, like GitHub)
- A "+" button opens a popover to search and add team members (from the same tenant)
- Collaborators can be removed by the creator
- When a project has collaborators, they see it in their saved searches list too

### 4. Update `useSourcingProjects` list hook

The list query already uses tenant-scoped access, but the RLS change above will automatically make collaborated projects appear in the list query results. No code change needed — the RLS handles visibility.

## Files

| File | Change |
|------|--------|
| New migration | Create `sourcing_project_collaborators` table + updated RLS policies |
| `src/components/sourcing/SourcingProjectCollaborators.tsx` | New — avatar group + invite popover |
| `src/components/sourcing/SourcingProjectView.tsx` | Add collaborator component to header |
| `src/hooks/useSourcingProjectCollaborators.ts` | New — CRUD hook for collaborators |

## Scope
- 1 migration (table + RLS updates)
- 2 new files (component + hook)
- 1 existing file edit (SourcingProjectView header)

