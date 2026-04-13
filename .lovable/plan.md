

# Fix PDL Profile Sheet + Add Cost Cap

## What's already working
- `sourcing-search` edge function is deployed (remotely) and returns PDL + Apollo results
- Frontend renders PDL rows with green badges, full names, skills
- `getDisplayName` helper already handles null-safe name resolution

## What's broken
When you click a PDL candidate row, it sets `selectedCandidateId` to the in-memory search ID. The `UniversalCandidateProfileSheet` routes to `IndependentCandidateProfileSheet`, which tries to fetch that ID from the `candidates` DB table. PDL candidates aren't in the DB yet, so the sheet opens empty/broken.

Also, `handleAddToPipeline` tries to insert a `job_candidate_associations` row using the in-memory ID as `candidate_id` — which doesn't exist in the `candidates` table, so it fails with a foreign key error.

## Changes

### 1. Create `PdlCandidateProfileSheet.tsx` (new file)
A presentational sliding sheet that receives the full PDL candidate object as props — no DB fetch. Renders:
- Header with full name, current role, company, location, LinkedIn button
- Contact info (email, phone) — visible immediately
- Summary text
- Skills chips
- Years of experience
- "Add to Pipeline" button

### 2. Update `UniversalCandidateProfileSheet.tsx`
- Add `pdlData` prop (the full `MatchedCandidate` object)
- Add third rendering branch: if `pdlData` is present, render `PdlCandidateProfileSheet`

### 3. Update `SourcingCandidateTable.tsx`
- Add `selectedPdlData` state to store the clicked PDL candidate's full data
- On PDL row click: set `selectedPdlData` instead of just `selectedCandidateId`
- Pass `pdlData={selectedPdlData}` to `UniversalCandidateProfileSheet`
- Update `handleAddToPipeline`: for PDL candidates, upsert into `candidates` table first (mapping `full_name` → `candidate_name`, etc.), then create the `job_candidate_associations` row with the real DB ID

### 4. Add `pdl_limit` param to the search call
- In `useSourcingProjectCandidates.ts`, pass `pdl_limit: 5` in the request body to `sourcing-search`
- The deployed edge function should already respect this param (or we'll update it if needed)

## Files

| File | Action |
|------|--------|
| `src/components/candidates/PdlCandidateProfileSheet.tsx` | **Create** — inline-data profile sheet |
| `src/components/candidates/UniversalCandidateProfileSheet.tsx` | **Edit** — add `pdlData` prop + third branch |
| `src/components/sourcing/SourcingCandidateTable.tsx` | **Edit** — add `selectedPdlData` state, wire click, fix `handleAddToPipeline` for PDL upsert |
| `src/hooks/useSourcingProjectCandidates.ts` | **Edit** — pass `pdl_limit: 5` to edge function |

