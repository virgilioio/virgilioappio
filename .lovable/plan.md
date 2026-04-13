
## What I found

PDL is still being called. The logs show:

- `🔍 PDL Search: limit=5...`
- `📡 PDL query: ...`
- `❌ PDL API Error: 404 {"message":"No records were found matching your search"}`

So the issue is not "PDL never runs". The issue is:

1. `search-pdl-candidates` is building an overly strict query:
   - top-level `bool.must`
   - exact `term` matching on `job_title`
   - exact `term` matching on `skills`
   - location also required
   - sometimes many filters are combined at once

2. `sourcing-search` currently sets `pdl_cache_expires_at` even when PDL returns `0` candidates, so a bad empty result gets cached for 24 hours and later loads may skip PDL entirely.

That explains both symptoms:
- first request returns 0 from PDL
- later requests appear to “not search PDL anymore” because the empty result was cached

## Plan

### 1. Relax the PDL query strategy
Update `supabase/functions/search-pdl-candidates/index.ts` so PDL search is broader and progressive instead of all-or-nothing.

Implementation approach:
- stop requiring `title + location + skills` all in the same `must`
- keep titles as the primary filter
- make skills and company filters optional boosters / fallback filters instead of mandatory filters
- make location optional or secondary
- use broader supported matching for free-text fields instead of exact-only matching where appropriate

Suggested search order:
1. titles + location
2. titles only
3. titles + keywords
4. titles + optional skills

Return the first non-empty result set.

### 2. Fix bad empty-result caching
Update `supabase/functions/sourcing-search/index.ts` so we do **not** mark PDL cache as valid when:
- the PDL call errors
- PDL returns 0 candidates
- there are no cached PDL rows to serve

Implementation details:
- only write `pdl_cache_expires_at` after a successful non-empty PDL result
- when checking cache, treat `pdl_cache_expires_at` as invalid if there are zero cached `source='pdl'` rows
- keep Apollo cache behavior unchanged

### 3. Clear stale empty PDL caches
Some projects likely already have `pdl_cache_expires_at` set from empty responses. Those need to be reset so PDL can run again immediately.

Scope:
- affected `sourcing_projects` rows where `pdl_cache_expires_at` is set but there are no cached PDL candidates

### 4. Validate with the current Find flow
After implementation, test the current Find route again and confirm:
- `search-pdl-candidates` logs show a broader query / fallback attempts
- `sourcing-search` no longer caches empty PDL responses
- repeated loads do not burn new credits when valid cached PDL rows exist
- PDL source count becomes non-zero for at least one of the current projects, or logs clearly show the broader query exhausted before falling back

## Files to update

- `supabase/functions/search-pdl-candidates/index.ts` — relax query builder and add fallback search strategy
- `supabase/functions/sourcing-search/index.ts` — fix PDL cache rules so empty/error responses are not cached
- one-time data reset for stale `pdl_cache_expires_at` values on affected projects

## Expected outcome

- PDL searches actually return candidates again when matches exist
- empty/failed PDL searches do not suppress future retries for 24 hours
- valid PDL results remain cached so credits are still protected
