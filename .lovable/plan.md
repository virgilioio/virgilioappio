

# Fix PDL Credit Burn + Pass Through Full Profile Data

## Problem

1. **100 credits burned**: The deployed `sourcing-search` edge function ignores the `pdl_limit: 5` param the frontend sends. It returned 100 PDL results = $28 worth of credits gone.
2. **Incomplete profile data**: The edge function strips `experience[]`, `education[]`, `certifications[]`, `emails[]`, `phones[]`, and social URLs before returning results. The `PdlCandidateProfileSheet` UI is ready to display them but gets empty arrays.

## Root Cause

Both `sourcing-search` and `search-pdl-candidates` edge functions were deployed externally (by Claude) and don't exist in `supabase/functions/`. We can't edit them without creating them locally first.

## Plan

### 1. Create `sourcing-search` edge function locally

Create `supabase/functions/sourcing-search/index.ts` — replaces the remote version. This function:

- Reads `{ sourcing_project_id, limit, pdl_limit }` from request body
- Fetches the project's `search_criteria` from DB
- Calls `search-pdl-candidates` and `search-apollo-candidates` in parallel via `supabase.functions.invoke()`
- **Enforces `pdl_limit`** (default 5, max 10) — caps what gets sent to the PDL function
- Merges results, deduplicates by LinkedIn URL, PDL candidates first
- Returns `{ candidates, source_breakdown, search_metadata }`

### 2. Create `search-pdl-candidates` edge function locally

Create `supabase/functions/search-pdl-candidates/index.ts` — replaces the remote version:

- Receives search criteria + `limit` (hard-capped at 10)
- Calls PDL Person Search API
- **Passes through ALL response fields** including `experience[]`, `education[]`, `certifications[]`, `emails[]`, `phones[]`, `github_url`, `twitter_url`, `job_title_levels[]`
- Maps to the expanded `MatchedCandidate` shape

### 3. Verify PDL_API_KEY secret

Check if `PDL_API_KEY` is already set. If not, prompt you to add it before deploying.

### 4. Deploy and test both functions

Deploy locally-managed versions which will replace the remote ones. Test with a small search to verify:
- PDL results capped at 5
- Full profile data (experience, education) comes through
- Profile sheet displays the rich data

## Files

| File | Action |
|------|--------|
| `supabase/functions/sourcing-search/index.ts` | **Create** — orchestrator with enforced PDL cap |
| `supabase/functions/search-pdl-candidates/index.ts` | **Create** — PDL API wrapper, full field passthrough |

## Cost Impact

- Before: 100 PDL results per search = ~$28
- After: 5 PDL results per search = ~$1.40 (configurable up to 10 = $2.80)

