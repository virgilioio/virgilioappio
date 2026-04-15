

# Increase Apollo Search Volume (Search is Free)

## Key Insight

Apollo search is **completely free** — zero credits consumed. Credits are only used when enriching/revealing contact details. The current 500-candidate cap is artificially low and unnecessary. Apollo returns `total_entries` which can be tens of thousands for broad searches.

## Current Bottlenecks

| Constraint | Current | Problem |
|---|---|---|
| `effectiveMaxResults` cap | 500 | Artificial ceiling |
| Cache insert limit | 300 rows | Only caches 300 of 500 fetched |
| `sourcing-search` passes `limit: 300` | 300 | Overrides even the 500 cap |
| 24h cache TTL | No way to get fresh results | Stale after first search |
| `useSourcingProjectCandidates` passes `limit: 500` | 500 | Client-side cap |

## Solution: Raise Limits + Auto-Paginate

Since search is free, we raise the ceiling to **2,000 candidates** per project and let the multi-page fetcher do its job automatically (20 pages x 100/page). No manual "Find More" button needed — you just get a bigger pool on first search.

## Changes

### 1. `supabase/functions/search-apollo-candidates/index.ts`
- Raise `max_results` default from 300 to 2000, max cap from 500 to 2000
- Raise cache insert limit from 300 to 2000 rows
- Increase delay between pages slightly (300ms) to respect rate limits at higher volume

### 2. `supabase/functions/sourcing-search/index.ts`
- Change Apollo `limit` and `max_results` from `Math.min(limit, 300)` to `Math.min(limit, 2000)`
- Update the default `limit` in `SearchRequest` from 300 to 2000

### 3. `src/hooks/useSourcingProjectCandidates.ts`
- Raise default `limit` from 500 to 2000

### 4. Keep "Refresh" as Cache-Buster
- The existing Refresh button already clears cache and re-fetches. With higher volume, this effectively acts as "Find More" since Apollo returns results in a different order over time. No new button needed.

## Result
First search automatically returns up to 2,000 candidates instead of 300-500. Zero extra cost. The table already handles large lists with virtual scrolling/pagination.

