

# Fix: `Cannot read properties of undefined (reading 'split')` on Find page

## Root Cause

PDL candidates return `full_name` but **not** `candidate_name`. The `SourcingCandidateTable` component accesses `candidate.candidate_name` (which is `undefined` for PDL results) and calls `.split()` on it, crashing the page.

## Fix

Create a display name helper that resolves `full_name || candidate_name || 'Unknown'` and use it everywhere `candidate_name` is referenced in `SourcingCandidateTable.tsx`. Also make `candidate_name` optional in the interface since PDL candidates don't have it.

### Changes to `src/components/sourcing/SourcingCandidateTable.tsx`

1. **Make `candidate_name` optional** in the `MatchedCandidate` interface (line 31): `candidate_name?: string`

2. **Add a helper** at the top of the component or file:
   ```ts
   const displayName = (c: MatchedCandidate) => c.full_name || c.candidate_name || 'Unknown'
   ```

3. **Replace all ~15 occurrences** of `candidate.candidate_name` with `displayName(candidate)` — this covers:
   - Avatar initials (lines 681, 1038) — the `.split()` crash sites
   - Name display (lines 686, 1044)
   - Aria labels (lines 671, 1032)
   - Toast messages (line 458)
   - Apollo preview data (lines 186, 229, 642, 1000)
   - Sort key reference (line 586) — keep as-is since it's a column key, not a value access

| File | Change |
|------|--------|
| `src/components/sourcing/SourcingCandidateTable.tsx` | Add `displayName` helper; replace all `candidate.candidate_name` value accesses with it; make `candidate_name` optional |

