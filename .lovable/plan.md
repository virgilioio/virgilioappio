# Add "Sales" system role for CRM-only users

Introduce **Sales** as a new system-level role alongside `admin` and `member`. Sales users get full CRM access (Companies, Deals, deal payments) and **no ATS access** (no Jobs, Candidates, Pipeline, Analytics, Members, Settings).

## Why this shape

- We already have a clean two-tier model: `system_role` (admin/member) at the workspace level, and job-level roles (recruiter / hiring manager / interviewer) at the assignment level.
- CRM access is currently gated by `isAdmin || isWorkspaceOwner || isPlatformAdmin` everywhere (sidebar, page guards, and RLS via `user_is_crm_admin_in_tenant`). Adding `sales` as a third system role plugs into the same gate.
- Sales is treated as a **billable seat** (same tier as Admin / Recruiter), not a free viewer.

## Database

**Extend `public.system_role` enum:** add `'sales'`.

**Update `user_is_crm_admin_in_tenant(_tenant_id)`** (rename mentally to "CRM access" — keep the function name for stability) to also return true when the caller is an active member with `system_role = 'sales'` in that tenant. RLS on `deals`, `deal_stages`, `deal_payments` already calls this function, so they pick up Sales access automatically.

**No changes** to ATS RLS — Sales has no `member`/`admin` row beyond `sales`, so existing job/candidate policies naturally exclude them.

## Frontend

**1. `usePermissions.ts`**
- Add `isSales = isMember-style check on system_role === 'sales'` (re-using the auth context — `memberRole` already surfaces system_role).
- Actually: introduce `isSalesUser` derived from `userType === 'member' && memberRole === 'sales'`.
- Update gates:
  - `canViewOrganizations` → add `|| isSalesUser`
  - All ATS perms (`canViewJobs`, `canViewCandidates*`, `canViewMembers`, `canViewBilling`, etc.) → explicitly exclude Sales (they only get CRM).
- Add `isSalesUser` to the returned `PermissionsState`.

**2. `AppSidebar.tsx`**
- Add `show` predicates so Sales sees only: CRM (Companies + Deals). Hide Dashboard/Jobs/Candidates/Pipeline/Analytics/Find/Members.
- Existing CRM `show: p.canViewOrganizations` already grants Sales access via the updated gate.

**3. Default landing route**
- In `AuthCallback` / post-login redirect, if the user is Sales-only, route to `/crm/deals` instead of `/dashboard`.

**4. Members management UI**
- `MemberInviteSheet.tsx`: add `'sales'` option to the role select with description "CRM only — manages companies and deals. No access to recruiting."
- `MembersTab.tsx` `getEffectiveRole`: return `'Sales'` when `m.system_role === 'sales'`. Mark Sales as a **billable** seat (`isBillableMember` returns true for sales).
- `MembersTable.tsx`: add `'Sales'` to the `effectiveRole` union and role-filter options; add a badge variant.
- `useSeatsPreview` / seat-upgrade confirmation: treat assigning Sales as a billable upgrade (same dialog as Admin/Recruiter).

**5. Settings access**
- Sales does NOT see Settings (already covered by existing gates which exclude non-admins). Confirm `SettingsSidebar` hides everything for Sales — they shouldn't reach Settings at all.

## Out of scope

- Sales sub-tiers (Sales Manager vs Sales Rep) — deferred; we'll layer that later via job/team-style assignments if needed.
- Per-deal owner-only RLS (Sales currently sees all tenant deals, like Admins). Can be tightened in a follow-up.
- Email/calendar integration scoping for Sales.
- Renaming `user_is_crm_admin_in_tenant` (kept for stability; it now means "can access CRM").

## Memory updates after build

- Update Core memory: "Roles: admin, member (Hiring Manager/Recruiter/Interviewer via job assignments), **sales (CRM-only)**."
- New memory entry under permissions describing Sales scope.
