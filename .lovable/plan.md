

# Fix Internal Candidate Source Filter

## Problem
The "Internal" filter checks `candidate.source === 'local'`, but collected Apollo candidates (which display the "Internal" badge) have `source === 'apollo'` with `is_preview === false` and a `candidate_id`. The filter logic doesn't match the badge logic, so filtering to "Internal" returns 0 results.

## Fix — 1 file

**`src/components/sourcing/SourcingProjectView.tsx`** (~line 152-157)

Replace the simple `source === 'local'` check with the same logic used by `isCollectedApollo` in the table component:

```ts
const isInternal = candidate.source === 'local' || 
  (candidate.source === 'apollo' && candidate.is_preview === false && !!candidate.candidate_id)
```

This matches candidates that are either directly local OR collected Apollo candidates (already in the database) — exactly the ones that get the "Internal" badge.

## Scope
- 1 line change in 1 file

