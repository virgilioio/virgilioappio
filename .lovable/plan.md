

# PDL Cost Control + Full Profile Sheet for PDL Candidates

## Problem

1. **Cost**: PDL charges $0.28 per result returned. With no limit, a single search could burn through your 500 trial credits fast.
2. **Broken profile view**: Clicking a PDL candidate sets `selectedCandidateId` to the ephemeral in-memory ID and opens `IndependentCandidateProfileSheet`, which tries to fetch from the `candidates` DB table. PDL candidates aren't in the DB yet, so the sheet opens empty/broken.
3. **No `sourcing-search` in repo**: The orchestrator edge function was deployed externally by Claude but doesn't exist in `supabase/functions/`. We need to create it locally so we can control it.

## Plan

### 1. Create `sourcing-search` edge function locally

Create `supabase/functions/sourcing-search/index.ts` — the orchestrator that the frontend already calls. This function:

- Receives `{ sourcing_project_id, limit }` from the frontend
- Fetches the project's `search_criteria` from the DB
- Calls `search-apollo-candidates` and `search-pdl-candidates` in parallel
- **Caps PDL results at 5** (configurable via a `pdl_limit` param, default 5, max 10) to control costs
- Passes the existing `limit` to Apollo (cheap/free searches)
- Merges and deduplicates results (PDL candidates first, then Apollo)
- Returns `{ candidates, source_breakdown: { pdl, apollo, full_data, preview_only, deduplicated } }`

This replaces whatever Claude deployed externally and gives us version control.

### 2. Create `search-pdl-candidates` edge function

Create `supabase/functions/search-pdl-candidates/index.ts`:

- Receives search criteria + `limit` (capped at 10)
- Calls PDL Person Search API with the criteria
- Uses `PDL_API_KEY` secret (will need to add if not already set)
- Maps PDL response fields to the `MatchedCandidate` shape: `full_name`, `current_role`, `current_company`, `linkedin_url`, `email`, `phone`, `skills`, `location_*`, `summary`, `years_experience`
- Sets `source: 'pdl'`, `is_preview: false`

### 3. Create `PdlCandidateProfileSheet` component

New file: `src/components/candidates/PdlCandidateProfileSheet.tsx`

A presentational sliding sheet that takes the full PDL candidate data as props (no DB fetch). Shows:
- Header: full name, current role, company, location, LinkedIn button
- Contact: email, phone (visible immediately — no reveal needed)
- Summary text
- Skills chips
- Years of experience
- "Add to Pipeline" button that upserts the candidate into the `candidates` table and maps PDL fields to your schema

### 4. Wire PDL data through the profile sheet system

**`SourcingCandidateTable.tsx`**: Add `selectedPdlData` state. When a PDL row is clicked, store the full candidate object instead of just the ID. Pass it as a new `pdlData` prop to `UniversalCandidateProfileSheet`.

**`UniversalCandidateProfileSheet.tsx`**: Add a third rendering branch — if `pdlData` is present, render `PdlCandidateProfileSheet`.

### 5. Update `handleAddToPipeline` for PDL candidates

PDL candidates don't exist in the `candidates` table yet, so `handleAddToPipeline` currently fails (it tries to insert a `job_candidate_associations` row with a non-existent `candidate_id`). Update it to:
- Detect PDL source
- Upsert into `candidates` table first (mapping `full_name` → `candidate_name`, `current_role` → `current_title`, etc.)
- Then create the `job_candidate_associations` row with the real DB ID

### 6. Add PDL API key secret

Check if `PDL_API_KEY` is already configured. If not, prompt to add it via the secrets tool.

## Files

| File | Action |
|------|--------|
| `supabase/functions/sourcing-search/index.ts` | **Create** — orchestrator with PDL cap of 5 |
| `supabase/functions/search-pdl-candidates/index.ts` | **Create** — PDL API wrapper |
| `src/components/candidates/PdlCandidateProfileSheet.tsx` | **Create** — inline-data profile sheet |
| `src/components/candidates/UniversalCandidateProfileSheet.tsx` | **Edit** — add `pdlData` prop + third branch |
| `src/components/sourcing/SourcingCandidateTable.tsx` | **Edit** — add `selectedPdlData` state, wire click handler, update `handleAddToPipeline` for PDL upsert |

## Cost Control Summary

- PDL results capped at **5 per search** (= $1.40 max per search)
- Frontend passes `pdl_limit` param so you can adjust later
- Apollo searches remain unlimited (free preview data)
- No additional PDL credits consumed when viewing or adding to pipeline (data already in memory)

