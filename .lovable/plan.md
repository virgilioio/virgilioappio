

# System Roles Migration — Completed Phases 1-3

## Architecture Change
- **System level**: Users are `Workspace Owner`, `Admin`, or `Member` (stored in `members.system_role`)
- **Job level**: Roles (`recruiter`, `hiring_manager`, `interviewer`) come from `job_assignments.role`

## Completed

### Phase 1 — Database
- ✅ Created `system_role` enum (`admin`, `member`)
- ✅ Added `system_role` column to `members` table
- ✅ Migrated data: `admin` → `admin`, all others → `member`
- ✅ Updated `resolve_org_context`, `get_member_role`, `get_user_member_data` to return `system_role`
- ✅ Updated `check_tenant_member_role` to use `system_role`
- ✅ Updated `auto_assign_job_creator_to_assignments` trigger
- ✅ Updated `audit_member_role_change` trigger

### Phase 2 — Frontend Permissions
- ✅ Removed `isRecruiter`, `isHiringManager`, `isInterviewer` from `usePermissions`
- ✅ Created `useJobRole(jobId)` hook for job-level role lookups
- ✅ Updated `jobScoping.ts` — `isRestrictedRole` no longer checks `isRecruiter`
- ✅ Updated `JobAssignmentGuard` — guards all non-admin members

### Phase 3 — UI Updates
- ✅ Updated `Header` nav — uses `isMember` instead of `isRecruiter`
- ✅ Updated `Dashboard` — sourcing panel for admin+ only
- ✅ Updated `JobSetupPanel` — readOnly for non-admin members
- ✅ Updated `BillingGuard` — members (non-admin) never blocked
- ✅ Updated `MembersTab` — paid seats = admins, collaborators = members
- ✅ Updated `Find` page RoleGate
- ✅ Updated `useScheduledBookings`, `useJobsForCandidateAssignment`, `useJobs`

## Phase 4 — Remaining Cleanup (Future)
- Drop `member_role` column from `members` table
- Drop old `member_role` enum type
- Update `MemberInviteSheet` role picker to only offer Admin/Member
- Update RLS policies that still reference `member_role` directly (not via helper functions)
