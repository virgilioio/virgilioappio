

# Improve Duplicate Candidate Error Handling

## Problem
When a user tries to create a candidate that already exists, they sometimes get a generic error toast instead of the merge dialog. This happens when the DB unique constraint `(email, candidate_name, tenant_id)` fires — either because the duplicate check missed the match (different org within the same tenant) or due to a race condition. The error message is unhelpful and "freaks users out."

## Root Cause
The duplicate check in `checkForDuplicateCandidate` queries by `email + organization_id`, but the DB constraint is on `email + candidate_name + tenant_id`. When a candidate exists in a different org within the same tenant, the check passes but the INSERT fails with a `23505` unique violation error, which surfaces as a raw DB error in a destructive toast.

## Fix — 2 files

### 1. `src/lib/candidateHelpers.ts` — Catch unique constraint violations
In `createCandidate`, catch error code `23505` (unique_violation) specifically. Instead of throwing a generic error, fetch the existing candidate and return a structured duplicate result so the caller can show the merge dialog.

```ts
if (createError.code === '23505') {
  // Unique constraint hit — find the existing candidate and return duplicate info
  const existing = await findExistingCandidate(candidateData, tenantId)
  if (existing) {
    return { isDuplicate: true, existingCandidate: existing, mergedData: smartMerge(existing, candidateData) }
  }
}
```

### 2. `src/hooks/useIndependentCandidates.ts` — Handle constraint-based duplicates
In `addCandidate`, after calling `createCandidate`, check if the result contains `isDuplicate` (from the new constraint catch). If so, return it as a `DuplicateResult` instead of treating it as a normal candidate — this lets the existing merge dialog flow in `Candidates.tsx` and `CandidateFormSheet` handle it gracefully.

### 3. `src/hooks/useCandidates.ts` — Same fix for job-context flow
Apply the same handling in the job-scoped `addCandidate` so the merge dialog works from both the Candidates page and the Job Detail page.

## Result
- No more generic error toasts for duplicate candidates
- The merge dialog appears in all cases — whether caught by the pre-check or by the DB constraint
- Zero UI changes needed — the existing `CandidateMergeDialog` handles everything

## Scope
- 3 file edits (~30 lines total)
- 0 migrations
- 0 new components

