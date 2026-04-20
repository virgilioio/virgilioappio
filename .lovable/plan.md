

## Problem

Admins (`system_role = 'admin'`, i.e. `permissions.isAdmin`) cannot see the **Workspace** group or **Departments** entry in Settings sidebar, even though `canManageOrganization` and `canViewMembers` already include them.

Two gates are wrong in `src/components/settings/SettingsSidebar.tsx` and one in `src/hooks/usePermissions.ts`:

1. **Workspace parent group** (line 73) — only shows for `isPlatformAdmin` or `workspace_owner`. Admins are excluded, so the entire group (Company Profile, Members, Job Settings, Integrations) is hidden from them.
2. **Departments top-level item** (line 55) — `canViewOrganizations` excludes admins.
3. **Workspace > Job Settings sub-item** (line 77) — same workspace_owner-only check.

## Fix

### `src/hooks/usePermissions.ts`
- `canViewOrganizations`: add `isAdmin` → `isPlatformAdmin || isWorkspaceOwner || isAdmin`.
  (Edit + delete already include admins; view should too.)

### `src/components/settings/SettingsSidebar.tsx`
- **Workspace group `show`** (line 73): change to `permissions.isPlatformAdmin || permissions.isAdmin || (userType === 'workspace_owner' && !!organizationId)`.
- **Workspace > Job Settings `show`** (line 77): include `permissions.isAdmin` too.
- **Integrations top-level item** (line 67): tweak the exclusion so admins see Integrations *inside* the Workspace group (which they now have access to) instead of as a top-level item — leave as-is, the existing `!isAdmin` clause already pushes admins to the Workspace > Integrations entry, which is correct once the Workspace group is visible to them.

That's it — admins will then see: My Profile, Departments, Workspace (Company Profile, Members, Job Settings, Integrations).

## Files touched

1. `src/hooks/usePermissions.ts` — add `isAdmin` to `canViewOrganizations`
2. `src/components/settings/SettingsSidebar.tsx` — admins in Workspace group + Job Settings sub-item

No DB, RLS, or backend changes. ~3 line edits.

