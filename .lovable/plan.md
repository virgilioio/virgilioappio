

# Fix Checkbox Selection on Duplicate Candidates

## Problem

The console shows: `Encountered two children with the same key 6363a463617d030001e1d122`. With the volume increase to 2,000 candidates, Apollo is returning duplicate entries (same `apollo_id`). React can't distinguish rows with identical keys, so clicking the checkbox on the first occurrence silently fails or targets the wrong DOM element.

Two fixes needed:

## 1. Deduplicate candidates in `useSourcingProjectCandidates.ts`

Before setting state, filter out duplicate `apollo_id` entries (keep the first occurrence). This is the proper fix — duplicates shouldn't reach the table at all.

```typescript
// After receiving data.candidates, before setMatchingResult:
const seen = new Set<string>()
const dedupedCandidates = (data.candidates || []).filter(c => {
  const key = c.apollo_id || c.pdl_id || c.id
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
```

## 2. Defensive unique keys in `SourcingCandidateTable.tsx`

Change `key={candidate.apollo_id || candidate.id}` to include the array index as a tiebreaker, ensuring React never sees duplicate keys even if dedup misses something:

- Line 755: `key={\`${candidate.apollo_id || candidate.id}-${startIndex + index}\`}`
- Line 1032: same pattern for the card view

## Files Modified

1. **`src/hooks/useSourcingProjectCandidates.ts`** — deduplicate candidates by `apollo_id`/`pdl_id`/`id` before storing
2. **`src/components/sourcing/SourcingCandidateTable.tsx`** — use unique composite keys on TableRow and Card elements (2 locations)

