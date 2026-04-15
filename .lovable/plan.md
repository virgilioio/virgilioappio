

# Gio Candidate Rich Profile Sheet

## What
When clicking a "Gio" candidate, open a rich profile sheet (reusing `PdlCandidateProfileSheet`) instead of the basic Apollo preview. Since Gio candidates are fully enriched in our DB, we can show skills, work experience, education, and summary — just like PDL candidates.

## Changes — 2 files

### 1. `supabase/functions/sourcing-search/index.ts` — Fetch rich data for cross-tenant matches
- Expand the candidates query (line 230) to also select: `skills`, `profile_summary`, `years_experience`
- After populating `crossTenantMap`, run a second query to fetch `candidate_work_experience` and `candidate_education` for cross-tenant candidate IDs
- In the Gio candidate mapping (line 274), include these fields mapped to the `MatchedCandidate` shape (same field names as PDL: `skills`, `summary`, `experience`, `education`)
- Set `is_preview: false` since we have full data, but keep `candidate_id: null` (security)

### 2. `src/components/sourcing/SourcingCandidateTable.tsx` — Route Gio clicks to PDL sheet
- In the click handler (line 722), instead of opening as Apollo preview, open Gio candidates via `setSelectedPdlData(candidate)` — the same path PDL candidates use
- This routes them to `PdlCandidateProfileSheet` which already renders experience, education, skills, summary, etc.
- The "Gio" badge and visual identity remain unchanged in the table

No new components needed — `PdlCandidateProfileSheet` already handles the `MatchedCandidate` interface with all the rich data fields.

## Security
- `candidate_id` remains `null` for Gio candidates — no cross-tenant DB access
- Work experience and education data is non-PII operational data (job titles, companies, schools)
- No tenant IDs or internal references exposed

## Scope
- 1 edge function edit (~30 lines)
- 1 component edit (~5 lines)

