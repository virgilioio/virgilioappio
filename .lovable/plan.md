

# Enforce Job-Scoped Visibility for Members

## Problem

Currently, all members (regardless of job assignments) see every job, every candidate, and every navigation item. The RLS and client-side logic don't restrict members to only their assigned jobs.

## Role Model

| Role | Sees | Navigation |
|---|---|---|
| **Admin / WO / PA** | Everything | All nav items |
| **Member + Recruiter on job(s)** | Only assigned jobs & their candidates | Home, Jobs, Pipeline, Candidates, Find |
| **Member + HM/Interviewer on job(s)** | Only assigned jobs (restricted view within each) | Home, Jobs, Pipeline |
| **Member + no assignments** | Nothing useful | Home, Jobs (empty) |

## Implementation Plan

### 1. New hook: `useUserJobRoles` 
**File:** `src/hooks/useUserJobRoles.ts`

Query `job_assignments` for the current user to get all their assignments with roles. Expose:
- `assignedJobIds: string[]` — all jobs the user is assigned to
- `hasRecruiterRole: boolean` — true if user is recruiter on at least one job
- `hasOnlyRestrictedRoles: boolean` — true if all assignments are HM/interviewer (no recruiter)
- `isLoading: boolean`

This replaces scattered calls to `fetchAssignedJobIds` and `useUserAssignedJobIds` with a single source of truth.

### 2. Filter jobs client-side in `useJobs.ts`
**File:** `src/hooks/useJobs.ts`

For non-admin members, after fetching jobs (RLS returns org-level), filter to only `assignedJobIds`. This ensures the Jobs page, Dashboard JobsOverview, and any other consumer only see assigned jobs.

Import `useUserJobRoles` or accept assigned job IDs as a parameter. Filter `filteredJobs` to only include jobs in the user's assignment set when the user is a member (not admin/WO/PA).

### 3. Update navigation visibility in `Header.tsx`
**File:** `src/components/layout/Header.tsx`

Use `useUserJobRoles` to conditionally show/hide nav items for members:
- **Find**: Show only if admin/WO/PA OR member with `hasRecruiterRole`
- **Candidates**: Show only if admin/WO/PA OR member with `hasRecruiterRole`
- **Analytics**: Already admin-only (no change)
- **Pipeline**: Show for all members with any assignment
- **Jobs**: Show for all members with any assignment

### 4. Update Dashboard widgets
**File:** `src/pages/Dashboard.tsx`

- **RecentSourcingProjects**: Only show if admin/WO/PA or `hasRecruiterRole`
- **JobsOverview**: Already uses `useJobs` which will be filtered (no extra change needed after step 2)
- **StaleCandidates**: Already uses `isRestrictedRole` + `fetchAssignedJobIds` — verify HM/interviewers only see their assigned jobs' stale candidates (already works)
- **PendingActivities**: Same pattern, already scoped (already works)

### 5. Guard page-level routes
**File:** `src/pages/Candidates.tsx`, `src/pages/Pipeline.tsx`

For the `/candidates` page: if user is member without recruiter role, redirect to `/dashboard`.
For the `/find` page: same logic.
For `/analytics`: already restricted to admin.

### 6. Update `usePermissions.ts`
**File:** `src/hooks/usePermissions.ts`

This is the trickiest part because `usePermissions` is synchronous and doesn't fetch data. Two approaches:

**Approach A (recommended):** Keep `usePermissions` as-is for static role checks. Use `useUserJobRoles` separately in components that need job-scoping. The navigation and page guards use both hooks together.

**Approach B:** Add async job-role data into permissions context. This would be a larger refactor.

Going with **Approach A** — minimal changes, each component that needs scoping imports `useUserJobRoles` alongside `usePermissions`.

## Files to Change

| File | Change |
|---|---|
| `src/hooks/useUserJobRoles.ts` | **New file.** Single query for all user assignments + derived booleans |
| `src/hooks/useJobs.ts` | Filter returned jobs to assigned-only for non-admin members |
| `src/components/layout/Header.tsx` | Conditionally hide Find, Candidates nav for non-recruiter members |
| `src/pages/Dashboard.tsx` | Hide RecentSourcingProjects for non-recruiter members |
| `src/pages/Candidates.tsx` | Redirect non-recruiter members away |
| `src/pages/Pipeline.tsx` | No change (already scoped via useJobs filter) |

No database changes needed — RLS already returns org-level data, and we filter client-side based on job_assignments.

