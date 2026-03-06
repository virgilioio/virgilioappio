

# Restrict Candidate Profile Sheet for Hiring Managers & Interviewers

## Approach

Use the existing `useJobRole(jobId)` hook inside `CandidateProfileSheet` to detect if the current user is a hiring manager or interviewer. Derive a single boolean `isRestrictedViewer` that gates all restricted UI elements. Admins, workspace owners, platform admins, and recruiters see everything as before.

```
isRestrictedViewer = (isHiringManagerOnJob || isInterviewerOnJob) && !isAdmin && !isWorkspaceOwner && !isPlatformAdmin
```

## What Gets Hidden

### 1. Associated Jobs Sidebar (left rail + mobile selector)
- `CandidateJobSidebar` (line ~815-821)
- `MobileJobSelector` (line ~880-888)
- Hidden entirely when `isRestrictedViewer`

### 2. Left Controls Card (line ~922-1002)
- Contains: Move to Pipeline, Add/Transfer, Move to Offer, Return to Pipeline, Reject, Mark as Hired
- Hidden entirely when `isRestrictedViewer`

### 3. Right Controls Card (line ~1567-1643)
- Contains: Edit, Download, Add Note, Send Email, Schedule Interview
- Hidden entirely when `isRestrictedViewer`

### 4. Left Tab Filtering (line ~1007-1015)
- Remove "Application Details" and "Overview" tabs from the tabs array
- Hiring managers/interviewers only see: Job Application, Resume (and Offer if applicable)

### 5. Right Tab Filtering (line ~1649-1657)
- Remove "Emails" and "Reminders" tabs
- Hiring managers/interviewers only see: Feed, Notes, Insights

## Files to Change

| File | Change |
|---|---|
| `src/components/candidates/CandidateProfileSheet.tsx` | Import `useJobRole`, derive `isRestrictedViewer`, wrap 5 UI sections with conditional rendering |

Single file change. No database or hook changes needed — `useJobRole` already provides everything required.

