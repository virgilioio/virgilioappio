

# Fix: Bulk Move from Pipeline Passes Empty Candidate Data

## Problem
When selecting candidates from the pipeline view and using "Move to pipeline", `JobDetail.tsx` passes `candidate_name: ''` with all-null fields (lines 999 and 1374). The `BulkMoveJobCandidatesToPipelineDialog` then runs `ensureIndependentCandidateId` which fails to find the candidate by name or LinkedIn (both empty/null), attempts to INSERT a new blank candidate, and hits the validation trigger we just added.

These candidates **already exist** in the `candidates` table — the IDs passed are real `candidate_id` values (mapped from associations in `PipelineOverview.tsx` line 140). There is no need to look them up or create them.

## Fix

### `BulkMoveJobCandidatesToPipelineDialog.tsx`
In `onConfirm`, check if `candidate.id` already looks like an existing candidate ID (i.e., it was passed from the pipeline). Since the `id` field in `JobCandidateLike` is already the independent candidate ID when coming from the pipeline, and `candidate_name` is empty, we can skip `ensureIndependentCandidateId` and use `candidate.id` directly:

```ts
const indId = c.candidate_name 
  ? await ensureIndependentCandidateId(c) 
  : c.id
```

### `JobDetail.tsx` (lines 999 and 1374)
No changes strictly needed, but as a defensive improvement, the empty-name objects are the root smell. The cleaner fix is in the dialog since it already has the candidate ID.

## Scope
- **`src/components/candidates/BulkMoveJobCandidatesToPipelineDialog.tsx`** — 1 line change in `onConfirm`

