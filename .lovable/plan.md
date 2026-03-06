

# Hide Candidate List & Job Setup for Hiring Managers/Interviewers

## Approach

Import `useJobRole(id)` and `usePermissions()` in `JobDetail.tsx` to derive `isRestrictedViewer` (same pattern used in `CandidateProfileSheet`). Filter the tabs in `JobDetailFloatingSidebar` and the mobile tab selector so hiring managers/interviewers only see **Job Dashboard** and **Pipeline Overview**.

## Changes

### 1. `JobDetailFloatingSidebar.tsx`
- Accept a new `isRestrictedViewer` prop
- Filter out `all-candidates` and `job-setup` tabs when `isRestrictedViewer` is true

### 2. `JobDetail.tsx`
- Import `useJobRole` hook
- Derive `isRestrictedViewer = (isHiringManagerOnJob || isInterviewerOnJob) && !isAdmin && !isWorkspaceOwner && !isPlatformAdmin`
- Pass `isRestrictedViewer` to `JobDetailFloatingSidebar`
- Guard the mobile tab options the same way (filter out "All Candidates" and "Job Setup" tabs)
- If `activeTab` is set to a restricted tab (e.g. via URL), reset it to `'pipeline'`

### 3. `JobDetailMobileHeader.tsx`
- No changes needed — the mobile tabs are rendered in `JobDetail.tsx` directly

Two files changed. No database changes.

