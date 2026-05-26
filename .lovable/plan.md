## Problem

After collecting an Apollo candidate inside a sourcing project:

1. The **Collected** segment (in the toolbar of the All view) stays empty.
2. The same row in the results list still shows the "Collect · 1 credit" CTA, the locked/obfuscated email/phone, and opens the **Apollo preview** sheet instead of the new collected-candidate sheet.

Root cause: `useSourcingProjectCandidates` is a `useState`-based hook (not React Query), so the `queryClient.invalidateQueries` calls after collect are no-ops. The candidate set is never re-fetched, so `display_source` stays `'apollo'` and `candidate_id` stays null. Meanwhile, the existing `collectedApolloIds` session set is tracked but never consulted by the segment filter, the row derivation (`isInternal`/`isApollo`/`canSelect`), the sheet router, or the segment counts.

Out of scope: `SavedCandidatesTab.tsx` is not wired into the sourcing project view at all right now — the user's "Collected tab" is the **Collected** segment in `SourcingCandidateTable`. We will not resurrect `SavedCandidatesTab`.

## Plan

**1. Refetch sourcing-search after every collect**

- Add `onCandidatesChanged?: () => void | Promise<void>` prop to `SourcingCandidateTable` and `CandidatesTab`.
- In `SourcingProjectView`, pass `refetchCandidates` (from `useSourcingProjectCandidates`) into `CandidatesTab` → `SourcingCandidateTable`.
- Call `onCandidatesChanged?.()` after success in `handleCollectProfile`, `executeBulkCollect`, and `handleCandidateCollected` (sheet path). This replaces the no-op `queryClient.invalidateQueries(['sourcing-candidates', ...])`.

**2. Treat session-collected rows as Internal (optimistic) until refetch lands**

In `SourcingCandidateTable`:

- Introduce `isSessionCollected(c) = !!c.apollo_id && collectedApolloIds.has(c.apollo_id)`.
- Update derivations on **both** desktop and mobile rows:
  - `isInternal = isCollectedApollo(candidate) || isSessionCollected(candidate)`
  - `isApollo` then naturally becomes false (it's already gated on `!isInternal`).
  - `canSelect = ... && !isSessionCollected(candidate)`
- Update `segmentCounts.collected` and the `'collected'` branch of the segment filter to: `(c.source === 'apollo' && !!c.candidate_id) || (c.apollo_id && collectedApolloIds.has(c.apollo_id))`.

This immediately:
- Replaces the "Collect · 1 credit" CTA with the "Add to job / Added to pipeline" actions.
- Replaces locked email/phone bars with the revealed values when the candidate object already has them (post-refetch); when it doesn't, falls back to neutral.
- Hides the bulk-select checkbox for the now-collected row.
- Makes the row count in the Collected segment go up immediately.

**3. Route session-collected rows to the Internal/Collected sheet**

- Track `apolloId → candidateId` in a new `collectedCandidateIds: Map<string,string>` ref/state, populated in `handleCandidateCollected(candidateId, apolloId)` and in the single/bulk collect success paths (using `data.results[].candidate_id` / `data.candidate_id` from `enrich-apollo-profile`).
- In `handleRowClick` / `handleCardClick`, when `isInternal` is true via the session set, resolve the candidate id from this map (fallback to `candidate.candidate_id || candidate.id`) and open `UniversalCandidateProfileSheet` with `candidateId` set and `apolloId`/`apolloData`/`pdlData` cleared — same path internal candidates already use. After refetch lands, `candidate.candidate_id` is populated and the map becomes redundant.

**4. Touch list**

- `src/components/sourcing/SourcingProjectView.tsx` — pass `refetchCandidates` down.
- `src/components/sourcing/CandidatesTab.tsx` — accept and forward `onCandidatesChanged`.
- `src/components/sourcing/SourcingCandidateTable.tsx` — accept prop, add session helpers, update segment filter + counts, update `isInternal`/`canSelect` on desktop + mobile, update click handlers, call refetch on collect success, capture `candidate_id` from collect response.

No backend, RLS, or schema changes. No changes to `SavedCandidatesTab.tsx`, `ArchivedCandidatesTab.tsx`, or `useSourcingProjectCandidates.ts` signature.

## Verification

- Collect a single Apollo candidate → row immediately shows green "Collected" badge, real (or neutral) contact line, "Add to job" CTA; Collected segment count increments; clicking the row opens the internal/collected candidate sheet.
- Bulk collect → same behavior for every selected row; checkboxes disappear on those rows.
- After the background `refetchCandidates` completes, the optimistic state and the server state agree; no flicker.
