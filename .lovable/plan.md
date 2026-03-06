

# Refactor: System-Level Roles vs Job-Level Roles

## The Problem

Today, `member_role` is an enum with 4 values: `admin`, `recruiter`, `hiring_manager`, `interviewer`. This means a user is permanently labeled a "recruiter" or "hiring manager" at the **system level**, which is wrong.

**How it should work (and how other ATS tools do it):**

```text
SYSTEM LEVEL (members table)          JOB LEVEL (job_assignments table)
┌─────────────────────────┐           ┌──────────────────────────────┐
│ Workspace Owner         │           │ Recruiter on Job A           │
│ Admin                   │  ──────>  │ Hiring Manager on Job B      │
│ Member                  │           │ Interviewer on Job C         │
└─────────────────────────┘           └──────────────────────────────┘
```

A "Member" has no inherent capabilities beyond what their job assignments grant them. They become a recruiter, hiring manager, or interviewer **per job**.

## Blast Radius Summary

| Area | Impact |
|------|--------|
| DB enum `member_role` | Change from `admin, recruiter, hiring_manager, interviewer` → `admin, member` |
| `resolve_org_context` RPC | Returns `member_role` — needs to return new values |
| `check_org_member_access` RPC | Checks `member_role` for recruiter — needs update |
| ~44 migration files | RLS policies reference `member_role IN ('admin','recruiter')` |
| `usePermissions` hook | Derives `isRecruiter`, `isHiringManager`, `isInterviewer` from system role — must derive from job context instead |
| `useMembers` hook | Types reference 4-role enum |
| `MemberInviteSheet` | Role picker offers recruiter/HM/interviewer — should only offer Admin/Member |
| `MembersTab` | Splits "paid" vs "collaborator" by role — needs rethinking |
| `jobScoping.ts` | `isRestrictedRole` checks `isRecruiter` — needs update |
| Billing/seats logic | `isBillableRole` = admin or recruiter — needs new model |
| Navigation/Header | Shows/hides items based on `isRecruiter` |
| Dashboard | Shows sourcing panel for `isRecruiter` |

## Migration Plan (4 Phases)

### Phase 1 — Database Schema

1. **Create new enum** `system_role` with values `admin`, `member`
2. **Migrate existing data**: map `recruiter` → `member`, `hiring_manager` → `member`, `interviewer` → `member`, `admin` → `admin`
3. **Add new column** `system_role` to `members`, populate from mapping
4. **Update `resolve_org_context`** to return `system_role` instead of `member_role`
5. **Update key RLS helper functions** (`check_org_member_access`, etc.) to use `system_role`
6. **Update RLS policies** that reference `member_role IN ('admin', 'recruiter')` → `system_role IN ('admin', 'member')` (since job-level access will come from `job_assignments`)
7. Eventually drop old `member_role` column (can be deferred)

**Critical RLS policy change**: Policies that currently say "admin or recruiter can do X" need to decide:
- Is this a **system-level** permission? → `system_role = 'admin'` (or workspace_owner)
- Is this a **job-scoped** permission? → Check `job_assignments` table for the user + job

### Phase 2 — Permissions & Auth Context

1. **`usePermissions`**: Remove `isRecruiter`, `isHiringManager`, `isInterviewer` as system-level flags. Add a new concept: "current user's role on a specific job" (loaded per-job, not globally)
2. **`AuthContext`**: `memberRole` returns `admin` or `member` only
3. **New hook: `useJobRole(jobId)`**: Returns the user's role on a specific job (`recruiter | hiring_manager | interviewer | null`)
4. **`jobScoping.ts`**: `isRestrictedRole` becomes simply `systemRole === 'member'` (all members are job-scoped unless they're admin/WO/PA)

### Phase 3 — UI Updates

1. **`MemberInviteSheet`**: Role picker changes to just Admin / Member
2. **`MembersTab`**: Remove "Members vs Collaborators" split (all are either Admin or Member). Billing model: Admins = paid seats, Members = free/collaborator tier
3. **`Header` / navigation**: Replace `isRecruiter` checks with system-level checks (e.g., `isAdmin || isMember` for navigation items that any logged-in member should see)
4. **`JobSetupPanel`**: Use `useJobRole(jobId)` to determine read-only vs editable
5. **Dashboard widgets**: Use job assignments to determine which jobs a member can see, rather than system-level role

### Phase 4 — Cleanup

1. Drop `member_role` column from `members` table
2. Drop old `member_role` enum type
3. Remove all references to old role values in code

## Key Design Decision: What Can a "Member" Do?

A **Member** (system level) by default can:
- Log in, see their profile
- See jobs they're assigned to (via `job_assignments`)
- Perform actions on those jobs based on their **job assignment role**

An **Admin** (system level) can:
- Everything a member can do
- View all jobs, all candidates
- Manage team members
- Manage organization settings

This means **all job-level permissions flow through `job_assignments`**, not through the system role.

## Risk & Mitigation

- **Data migration**: Existing `recruiter` members become `member` — they keep access to their jobs via existing `job_assignments` records. BUT: we need to verify all current recruiters have proper `job_assignments` records, or they'll lose access to jobs they could previously see.
- **RLS policies**: ~44 migration files reference the old enum. We'll create new replacement policies in a single migration rather than editing old files.
- **Gradual rollout**: We can keep the old `member_role` column temporarily while the new `system_role` column takes over, to avoid a big-bang migration.

