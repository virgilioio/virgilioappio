## Problem

In `/pipeline`, expanding a job and clicking a candidate card navigates to `/candidates/${candId}` (independent candidate page) instead of the in-job candidate profile for that job.

## Root Cause

`src/components/pipeline/InlineKanban.tsx` line 197:

```ts
onCandidateClick={(candId) => navigate(`/candidates/${candId}`)}
```

It ignores `jobId` even though the InlineKanban is scoped to a specific job.

## Fix

Change the navigation target to the job-scoped candidate route used elsewhere in the app (see `src/pages/CandidateProfile.tsx`, route `/jobs/:jobId/candidates/:candidateId`):

```ts
onCandidateClick={(candId) => navigate(`/jobs/${jobId}/candidates/${candId}`)}
```

Single-line change in `src/components/pipeline/InlineKanban.tsx`. No data, permission, or DnD logic changes.
