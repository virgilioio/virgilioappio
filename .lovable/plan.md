

# Fix Double PDL Calls + Deploy Fixed Query

## Problems

1. **Deployed code is stale**: The `search-pdl-candidates` function still uses `match` + `fuzziness: "AUTO"` syntax that PDL rejects with 400. The local fix (using `term`) was never deployed. Each failed call still burns credits on PDL's side.

2. **Double invocation**: The `useEffect` in `useSourcingProjectCandidates.ts` fires `fetchMatchingCandidates` twice due to React re-renders causing the `useCallback` to get a new reference. The logs show two `sourcing-search` calls 5 seconds apart for the same project.

3. **Error handling**: The PDL function throws on 400 errors instead of returning a 200 with empty results, so the graceful fallback doesn't work.

## Plan

### 1. Deploy `search-pdl-candidates` with the fix already in the codebase
The local code already has the correct `term`-based query. Just needs to be deployed.

### 2. Fix double-call in `useSourcingProjectCandidates.ts`
- Add a `useRef` guard (`isFetching`) to prevent concurrent duplicate calls
- Stabilize the `useCallback` dependencies so React strict mode / re-renders don't trigger it twice

### 3. Verify error handling in `search-pdl-candidates`
- Ensure 400/500 PDL API responses return `{ candidates: [], total_count: 0 }` with status 200 (not throw)
- Check current code handles this correctly; fix if not

## Files

| File | Action |
|------|--------|
| `supabase/functions/search-pdl-candidates/index.ts` | **Deploy** (already fixed locally) + verify error path returns 200 |
| `src/hooks/useSourcingProjectCandidates.ts` | **Edit** — add fetch guard to prevent double invocation |

## Cost Impact
- Eliminates double-call: 10 credits → 5 credits per search
- Cache prevents repeat searches: subsequent loads = 0 credits

