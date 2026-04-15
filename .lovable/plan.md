

# Fix Inconsistent Keyword Badges on Cached Results

## Root Cause

The keyword badges (e.g., "SAP, ERP") only appear on the **first** search when Apollo results are fetched fresh. On every subsequent load, results come from the 24-hour cache — and the cache path in `search-apollo-candidates` **skips keyword scoring entirely**.

```text
Fresh fetch path:  Apollo API → mapApolloSearchCandidate(c, keywords) → keyword_score ✅, matched_keywords ✅
Cache path:        sourcing_preview_candidates → raw map → keyword_score ❌, matched_keywords ❌
```

The cache table doesn't store `keyword_score` or `matched_keywords` columns either, so there's no data to map even if we tried.

## Fix

Re-apply keyword scoring to cached candidates before returning them. The `criteria` object (containing `keywords`) is already available in the function since it's passed from `sourcing-search`.

## Changes

### `supabase/functions/search-apollo-candidates/index.ts`

In the cache hit path (around line 399), after mapping cached rows, re-run keyword scoring on each candidate using the same logic as the fresh path:

1. Accept `criteria` from the request body (already parsed but not used in cache path)
2. For each cached candidate, build a mini corpus from `headline` + `current_company` + `current_title`
3. Match against `criteria.keywords` — same loop as `mapApolloSearchCandidate`
4. Attach `keyword_score` and `matched_keywords` to each cached candidate
5. Re-sort by `keyword_score` descending (same as fresh path)

This is lightweight — just string matching against 2-3 fields per candidate. No API calls, no DB writes.

## Result

Keyword badges will appear consistently whether results come from cache or fresh fetch. The scoring is deterministic and uses the same keywords, so badges will be identical across loads.

