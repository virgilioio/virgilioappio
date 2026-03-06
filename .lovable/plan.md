

# Frontend `member_role` Cleanup — Full Audit & Plan

## All 25 files still referencing `member_role`

Here is every frontend file that still uses the old role values, grouped by what needs to change:

### Group 1: Core Types & Hooks (must change first)

| File | What references `member_role` | Change needed |
|------|------|------|
| `src/hooks/useMembers.ts` | `Member` interface, `CreateMemberData`, `UpdateMemberData` all typed as `'admin' \| 'recruiter' \| 'hiring_manager' \| 'interviewer'`; `createMember` checks `isBillableRole` against old values; inserts `member_role` into DB | Add `system_role` field to interfaces (`'admin' \| 'member'`). Change `createMember` to set `system_role` on insert. Update billing check: only `system_role === 'admin'` is billable. Keep `member_role` write temporarily for backward compat. |
| `src/hooks/useCustomerMembers.ts` | Interface has `member_role: string`; selects `member_role` from DB | Add `system_role` to select and interface |
| `src/hooks/useSaaSCustomerMembers.ts` | `SaaSMember` interface has `member_role: string` | Add `system_role` to interface |
| `src/hooks/useRecruiterOptions.ts` | Filters `.in('member_role', ['admin', 'recruiter'])` and badges by `member_role` | Change filter to `system_role` — all active members can potentially be assigned as recruiters on jobs. Or filter by `system_role IN ('admin', 'member')` (i.e., all active members). Badge should show system role. |
| `src/hooks/useAnalyticsFilterOptions.ts` | Filters `.in('member_role', ['admin', 'recruiter'])` | Same as above — use `system_role` |
| `src/hooks/useOfferApprovalRequest.ts` | Selects `member_role` to build `rolesMap` | Select `system_role` instead |
| `src/hooks/useOfferApprovalChain.ts` | Selects `member_role` to build `rolesMap` | Select `system_role` instead |
| `src/integrations/supabase/types.ts` | Auto-generated types reference `member_role` enum | Will update after DB enum changes are finalized (auto-generated) |
| `src/lib/organizationMetadata.ts` | Interface has `member_role?: string` | Rename to `system_role` |

### Group 2: UI Components

| File | What references `member_role` | Change needed |
|------|------|------|
| `src/components/members/MembersTable.tsx` | Displays `member.member_role` in badge; `getRoleColor` maps old roles; filters job assignments by `['hiring_manager', 'interviewer'].includes(member.member_role)` | Display `system_role`. Simplify `getRoleColor` to just `admin`/`member`. Remove role-based gating on "Manage Job Access" — any active member can have job assignments. |
| `src/components/members/MemberInviteSheet.tsx` | `getRoleOptions()` returns recruiter/hiring_manager/interviewer; submits `member_role: data.role` | Change to only `admin` and `member` options. Submit as `system_role`. |
| `src/components/settings/MembersTab.tsx` | `isPayingRole` checks old enum; filters `paidMembers`/`collaboratorMembers` by `m.member_role === 'admin'` | Already partially updated but still references `member_role`. Switch to `system_role`. |
| `src/components/saas/MembersList.tsx` | Displays `member.member_role` as badge; searches by `member_role` | Display `system_role` instead |
| `src/components/jobs/stage-config/TeamTab.tsx` | Enriches interviewers with `member_role` from members; displays as badge | Show `system_role` or better yet show their **job assignment role** instead |
| `src/components/jobs/JobFormSheet.tsx` | Shows `member.member_role` next to email in badges | Show `system_role` |
| `src/components/debug/OrganizationDebug.tsx` | Displays `member_role` in debug panel | Show `system_role` |

### Group 3: Auth & Invitation Flow

| File | What references `member_role` | Change needed |
|------|------|------|
| `src/pages/AcceptInvite.tsx` | `InvitationData` interface has `member_role`; toast shows `member_role.replace('_', ' ')` | This comes from the `validate_invitation` RPC — will show whatever the RPC returns. Update interface and display to use `system_role`. |
| `src/pages/AuthCallback.tsx` | Toast shows `reconcileResult?.member_role?.replace('_', ' ')` | Use `system_role` from reconciliation result |
| `src/lib/invitationReconciliation.ts` | Interface has `member_role: string | null` | Rename to `system_role` |

### Group 4: Low-impact / Read-only references

| File | What references `member_role` |
|------|------|
| `src/hooks/useSeatsPreview.ts` | Likely checks `isBillableRole` — needs update |
| `src/hooks/useAuthBootstrap.ts` | May read `member_role` from `resolve_org_context` — already updated in Phase 1 to use `system_role`? Needs verification |

## Implementation Order

1. **`useMembers.ts`** — Add `system_role` to `Member` interface and all data flows. Keep `member_role` as optional legacy field.
2. **`MemberInviteSheet.tsx`** — Simplify role picker to Admin/Member. Submit `system_role`.
3. **`MembersTable.tsx`** — Display `system_role`, simplify role colors, remove role-gating on job assignments.
4. **`MembersTab.tsx`** — Switch seat filtering to `system_role`.
5. **Other hooks** (`useRecruiterOptions`, `useAnalyticsFilterOptions`, `useOfferApprovalRequest`, `useOfferApprovalChain`, `useCustomerMembers`, `useSaaSCustomerMembers`) — Switch DB queries and interfaces to `system_role`.
6. **Other UI** (`TeamTab`, `JobFormSheet`, `MembersList`, `OrganizationDebug`) — Display `system_role`.
7. **Auth flow** (`AcceptInvite`, `AuthCallback`, `invitationReconciliation`, `organizationMetadata`) — Update interfaces and display strings.
8. **`useSeatsPreview`** — Update billable role logic.

This is approximately 20 files to update. No new DB migration needed — the `system_role` column already exists from Phase 1. This is purely a frontend refactor to read the new column instead of the old one.

