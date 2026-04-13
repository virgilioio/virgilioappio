

# Add PDL Result Caching + Create Local Edge Functions

## Problem

Every time you open a sourcing project or refresh, the `sourcing-search` function fires a fresh PDL API call — burning ~$0.28 per result returned. There's no caching for PDL results. Apollo already has a 24-hour cache using `sourcing_preview_candidates` table + `sourcing_cache_expires_at` column, but PDL bypasses all of that.

## What Already Exists

- **Apollo caching**: `sourcing_preview_candidates` table stores Apollo results per project, checked via `sourcing_cache_expires_at` on `sourcing_projects` — 24h TTL, 0 credits on cache hit
- **Cache invalidation**: `SourcingProjectView.handleUpdateSearchCriteria` clears `sourcing_cache_expires_at` when criteria change
- **No PDL cache columns**: The `sourcing_preview_candidates` table lacks `pdl_id`, `source`, `experience`, `education`, `skills`, `emails`, `phones` etc.

## Plan

### 1. DB Migration — Add PDL cache columns to `sourcing_preview_candidates`

Add columns to support caching PDL results alongside Apollo results:

- `source` TEXT DEFAULT 'apollo' — distinguish PDL vs Apollo cached rows
- `pdl_id` TEXT — PDL person identifier
- `skills` JSONB — skills array
- `linkedin_url` TEXT — full LinkedIn URL (PDL provides this)
- `summary` TEXT — PDL profile summary
- `experience` JSONB — full work history array
- `education` JSONB — full education array
- `certifications` JSONB — certifications array
- `emails` JSONB — email addresses array
- `phones` JSONB — phone numbers array
- `github_url` TEXT
- `twitter_url` TEXT
- `website_url` TEXT
- `job_title_levels` JSONB — seniority indicators
- `location_city` TEXT, `location_state` TEXT, `location_country` TEXT

Also add `pdl_cache_expires_at` column to `sourcing_projects` table (separate from Apollo's `sourcing_cache_expires_at`) so each provider's cache is independent.

### 2. Create `supabase/functions/search-pdl-candidates/index.ts`

PDL API wrapper that:
- Accepts `{ criteria, limit }` — **hard-caps limit at 10**
- Calls PDL Person Search API (`https://api.peopledatalabs.com/v5/person/search`)
- Builds ElasticSearch query from criteria (title, location, skills, companies)
- **Passes through ALL fields**: `experience[]`, `education[]`, `certifications[]`, `emails[]`, `phones[]`, social URLs, `job_title_levels[]`, `summary`, `skills`
- Maps to `MatchedCandidate` shape with `source: 'pdl'`

### 3. Create `supabase/functions/sourcing-search/index.ts`

Orchestrator that:
- Reads `{ sourcing_project_id, limit, pdl_limit }` from request
- Fetches project's `search_criteria` and cache timestamps from DB
- **Checks PDL cache first**: if `pdl_cache_expires_at > now()`, loads cached PDL results from `sourcing_preview_candidates WHERE source = 'pdl'` — 0 credits
- **Checks Apollo cache**: same pattern using existing `sourcing_cache_expires_at`
- Only calls provider APIs on cache miss
- **Enforces `pdl_limit`** (default 5, max 10) when calling `search-pdl-candidates`
- After fresh PDL results: caches them to `sourcing_preview_candidates` with `source = 'pdl'` and sets `pdl_cache_expires_at` to now + 24h
- Merges PDL + Apollo results, deduplicates by LinkedIn URL
- Returns `{ candidates, source_breakdown, search_metadata }`

### 4. Update frontend cache invalidation

In `SourcingProjectView.handleUpdateSearchCriteria`, also clear `pdl_cache_expires_at` when criteria change — so a fresh PDL search only happens after explicit criteria updates.

## Files

| File | Action |
|------|--------|
| Migration SQL | **Create** — add PDL columns to `sourcing_preview_candidates`, add `pdl_cache_expires_at` to `sourcing_projects` |
| `supabase/functions/search-pdl-candidates/index.ts` | **Create** — PDL API wrapper, hard cap 10, full field passthrough |
| `supabase/functions/sourcing-search/index.ts` | **Create** — orchestrator with dual-provider caching |
| `src/components/sourcing/SourcingProjectView.tsx` | **Edit** — clear `pdl_cache_expires_at` on criteria update |

## Cost Impact

- **Before**: 100 PDL results per search, no caching = ~$28 per search, repeated on every page load
- **After**: 5 PDL results per search, cached 24h = ~$1.40 on first search, $0 on subsequent loads

