

# Fix Internal Candidate Click in Sourcing Results

## Problem
When clicking an "Internal" (collected Apollo) candidate row, the profile sheet shows loading skeletons forever. The click handler on line 706 sets `selectedCandidateId = candidate.id`, but for collected Apollo candidates `candidate.id` is the Apollo/sourcing result ID — not the actual database record ID. The real DB ID lives in `candidate.candidate_id`. The sheet then tries to fetch a non-existent candidate from the DB, resulting in an endless loading state.

## Fix — 1 file

**`src/components/sourcing/SourcingCandidateTable.tsx`** (line 706)

Change:
```ts
setSelectedCandidateId(candidate.id)
```
To:
```ts
setSelectedCandidateId(candidate.candidate_id || candidate.id)
```

This ensures the sheet receives the correct database ID for collected Apollo candidates, while falling back to `candidate.id` for truly local candidates where the ID is already correct.

## Scope
- 1 line change in 1 file
- 0 backend changes

