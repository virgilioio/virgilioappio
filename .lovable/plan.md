

# Fix: Dashboard Data Leaking Across Job Boundaries

## Problem

Several dashboard widgets show data from ALL jobs in the tenant, even to users (Hiring Managers, Interviewers) who should only see data for jobs they're assigned to. This violates the job visibility rules where HMs/Interviewers should only see jobs they're explicitly assigned to.

### Affected Components

| Widget | Issue | Severity |
|--------|-------|----------|
| **Stale Candidates** | No job filtering at all -- shows all stale candidates across tenant | High |
| **Pending Tasks (Decisions)** | `fetchNeedsDecision` shows all candidates needing decisions, no job filter | High |
| **Pending Tasks (Emails)** | `fetchUnreadEmails` shows all unread emails, no job/user filter | High |
| **Upcoming Activities (Reminders)** | `useDashboardReminders` shows all org reminders, no job filter | Medium |
| **Recent Searches** | Tenant-scoped, acceptable for recruiter-level feature | Low (acceptable) |
| **Upcoming Activities (Bookings)** | Already properly filtered by role/assignment | None |
| **Pending Tasks (Scorecards)** | Already filtered by `interviewer_id` for non-admins | None |

### Who is affected?

- **Admins, Workspace Owners, Platform Admins**: Should see everything within their tenant (no change needed for them)
- **Recruiters**: Per existing rules, recruiters see all jobs -- so they should see all dashboard data within the tenant (no change needed)
- **Hiring Managers and Interviewers**: Should ONLY see data for jobs they're assigned to. This is currently broken.

## Solution

For each affected hook, add a job-scoping step for non-admin/non-recruiter users:

1. Fetch the user's assigned job IDs from `job_assignments`
2. Filter query results to only include data from those jobs
3. Admins and recruiters bypass this filter (they see all jobs)

### File Changes

### 1. `src/hooks/useStaleCandidates.ts`

- Add `useAuth` and `usePermissions` imports
- Accept the current user context
- For non-admin/non-recruiter users, fetch their assigned job IDs from `job_assignments`
- Add `.in('job_id', assignedJobIds)` filter to the main query
- Admins/recruiters skip this filter

### 2. `src/hooks/usePendingActivities.ts`

**`fetchNeedsDecision` function:**
- For non-admin users, pass an array of accessible job IDs
- Add `.in('job_id', accessibleJobIds)` to the associations query
- This ensures HMs/Interviewers only see decision prompts for their assigned jobs

**`fetchUnreadEmails` function:**
- For non-admin users, filter emails by accessible job IDs
- Add `.in('job_id', accessibleJobIds)` to the emails query
- Also add a user-level filter: only show emails where the current user sent the original outbound email (by checking thread ownership), or fall back to job-based filtering

### 3. `src/hooks/useCandidateReminders.ts` (`useDashboardReminders`)

- For non-admin/non-recruiter users, fetch assigned job IDs
- Filter reminders to only show those linked to assigned jobs
- Additionally, always show reminders created by the current user (they set the reminder, they should see it)

### Implementation Pattern

Each hook will follow this pattern:

```text
1. Check user role (admin/recruiter vs HM/interviewer)
2. If restricted role:
   a. Fetch job_assignments for current user
   b. Extract job IDs
   c. Add .in('job_id', jobIds) to query
3. If admin/recruiter: no additional filtering (tenant isolation is sufficient)
```

### What stays unchanged

- **Recent Searches**: Tenant-scoped, only visible to admin/recruiter roles anyway (controlled by `showSourcingPanel` in Dashboard.tsx)
- **Scheduled Bookings**: Already properly filtered
- **Pending Scorecards**: Already filtered by `interviewer_id`

## Technical Details

- The `job_assignments` table is the source of truth for user-to-job assignment
- All filtering is additive (AND with existing tenant isolation)
- RLS on `jobs` already enforces visibility, but these dashboard queries join through other tables (associations, bookings, emails) that may not have the same RLS constraints, so application-level filtering is necessary as defense-in-depth

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/useStaleCandidates.ts` | Add job-scoping for non-admin/non-recruiter users |
| `src/hooks/usePendingActivities.ts` | Add job-scoping to `fetchNeedsDecision` and `fetchUnreadEmails` |
| `src/hooks/useCandidateReminders.ts` | Add job-scoping to `useDashboardReminders` for restricted roles |

