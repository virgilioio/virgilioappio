# Find: collected candidates + resume empty states

Three fixes, all scoped to the Find / sourcing project flow and the in-job candidate profile resume tab.

## 1. Collected candidate opens the Apollo preview sheet (with full data)

**Where:** `src/components/sourcing/SourcingCandidateTable.tsx` (row click) and `src/components/sourcing/SavedCandidatesTab.tsx` (Collected list click).

**Today:** Clicking a collected row routes through `UniversalCandidateProfileSheet`. Since a `candidateId` is set, the router falls into `CandidateProfileSheet` / `IndependentCandidateProfileSheet`. That's the "old independent sheet" the user is seeing.

**Change:** When a candidate is identified as Internal/collected (i.e. `display_source === 'internal'` or already in `collectedApolloIds`), open the existing `ApolloPreviewSheet` instead, passing:
- `candidateId` → the DB candidate id (so the sheet can hydrate the full enriched profile via its existing data fetch path)
- `apolloId` → the candidate's apollo_id
- `apolloData` → the row's apollo fields (headline, score, email/phone, company, location, etc.)

Implementation:
- Extend `UniversalCandidateProfileSheet` router so the `ApolloPreviewSheet` branch is taken whenever `apolloId` is present (regardless of whether `candidateId` is also set). It already accepts both props.
- In `SourcingCandidateTable.handleRowClick`, the `isInternal` branch must also set `selectedApolloId` + `selectedApolloData` from the candidate row (so the sheet has the Apollo context, not just the DB id).
- In `SavedCandidatesTab`, pass `apolloId` and an `apolloData` object built from the `SavedCandidate` fields. Drop the `context: 'job'/'independent'` branching for collected rows.
- Verify `ApolloPreviewSheet` renders the full enriched view when both `candidateId` + `apolloId` are present — it already fetches enriched data when a candidate id is known. No new data sources.

## 2. Collected segment empty + obfuscated after refresh

**Where:** `supabase/functions/sourcing-search/index.ts` (server) and `src/components/sourcing/SourcingCandidateTable.tsx` (segment filter).

**Symptom:** Before refresh, optimistic state (`collectedApolloIds`) makes collected rows show full name + Internal badge and populate the Collected segment. After refresh, `collectedApolloIds` is empty and the server response must do the work — but the row still looks like a raw Apollo preview (obfuscated, no Internal badge), and the Collected segment is empty.

**Root cause (to confirm during implementation):** The `sameTenantMap` lookup in `sourcing-search` only matches rows in `candidates` that have `apollo_id` set. Collected rows created through `enrich-apollo-profile` must always carry `apollo_id` for this join to succeed. If a code path stores the candidate without `apollo_id` (or under a different column), the search returns the raw Apollo preview on next load.

**Changes:**
1. **sourcing-search**: broaden the lookup to also match by `apollo_collected_at IS NOT NULL` + secondary keys (e.g. linkedin url) as a safety net, and log the count of matched vs unmatched. Ensure the returned row keeps `display_source: 'internal'`, `is_preview: false`, `needs_enrichment: false`, `candidate_id`, plus the full `candidate_name` from the DB (no obfuscation).
2. **enrich-apollo-profile**: re-verify that every newly created candidate row has `apollo_id` persisted alongside `apollo_collected_at` (backfill in the same migration-free patch if any row is missing it for the active session).
3. **SourcingCandidateTable**: change the Collected segment predicate to trust `display_source === 'internal'` (the unified helper) instead of the legacy `source === 'apollo' && !!candidate_id` check, so server-returned internal candidates always count.

Net effect: refreshing the page keeps collected rows visible with full name, the Internal badge, and they show up under the Collected segment without relying on session state.

## 3. Standardize resume empty states (in-job candidate profile)

**Where:**
- `src/components/candidates/CandidateProfileSheet.tsx` — Resume tab (lines ~1367-1407)
- `src/components/candidates/CandidateResumeViewer.tsx` — `!effectiveUrl` block (lines ~203-211)
- `src/components/candidates/ScorecardSheet.tsx` — `No resume available.` (line 1015)

**Change:** Replace every legacy "No resume" surface with the canonical `<EmptyState variant="inline" mascot title body action? />` primitive. Mascot defaults true for inline per the design memory.
- Resume tab when there is no attachment → keep the existing `EmptyState` but make sure it uses the canonical props (`mascot` implicit, no `description` override needed) and ships the Gio mascot illustration.
- `CandidateResumeViewer` no-URL fallback → swap the hand-rolled `<Card>` for `<EmptyState variant="inline" title="No resume available" body="Upload a resume to view it here." />`.
- `ScorecardSheet` `InlineEmpty("No resume available.")` → same canonical `EmptyState`.

No behavior changes, no new actions; only the visual primitive is updated so all surfaces match the rest of the app.

## Out of scope
- No schema changes, no new edge functions, no changes to PDL sheet or Apollo collection flow.
- No changes to the unrelated tabs of `SourcingProjectView`, `JobDetail`, or other candidate sheets.

## Verification
- Open a sourcing project, collect a candidate, click it → Apollo preview sheet opens with full data.
- Refresh the page → the same row still shows full name, Internal badge, and is counted under the Collected segment.
- Open an in-job candidate with no resume → see the new mascot-based empty state in all three resume surfaces.
