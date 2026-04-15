

# Fix: Collected Candidates Showing as Apollo Preview

## Root Cause

Two bugs working together:

### Bug 1: Cache query silently capped at 1000 rows
In `search-apollo-candidates/index.ts` (line 393-397), the cache query has no `.limit()`:
```typescript
const { data: cachedCandidates } = await supabase
  .from('sourcing_preview_candidates')
  .select('*')
  .eq('sourcing_project_id', project_id)
  .eq('source', 'apollo');
// ← Supabase default limit = 1000, but 2000 rows exist
```

Logs confirm: "Apollo returned 1000 candidates (cached: true)" vs "Apollo returned 2000 candidates (cached: false)" for fresh fetches. Half the candidates vanish on cache hits, and some collected ones may be in the lost half.

### Bug 2: Cross-reference may also be capped
In `sourcing-search/index.ts` (line 228-232), the query to find collected candidates uses `.in('apollo_id', apolloIds)` with up to 2000 IDs. While the response won't exceed 1000 rows by default, the current tenant only has ~254 collected candidates so this isn't actively breaking — but it's a ticking time bomb.

## Changes

### 1. `supabase/functions/search-apollo-candidates/index.ts`
- Add `.limit(2000)` to the cache query at line 393-397

### 2. `supabase/functions/sourcing-search/index.ts`
- Add `.limit(2000)` to the collected candidates cross-reference query (line 228-232) as a safety measure
- Add `.limit(2000)` to the PDL cache query (line 72-76) for consistency

Both functions redeployed.

## Result
All 2000 cached candidates are returned, cross-referenced correctly against collected candidates, and displayed with the proper "Internal" badge.

