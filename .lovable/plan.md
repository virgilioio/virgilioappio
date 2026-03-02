
Goal: make the old full-page candidate profile effectively disappear so every entry point (including notifications) opens the modern candidate sheet experience.

What I found
- The legacy route is still active in routing:
  - `src/App.tsx` has `"/candidates/:candidateId" -> <IndependentCandidateProfile />`
- Even after your notification change, several parts of the app still generate legacy URLs:
  - `src/components/candidates/CandidateTable.tsx`
  - `src/components/sourcing/SourcingCandidateCard.tsx`
  - `src/components/booking/BookingDetailsDialog.tsx`
  - `src/hooks/useGlobalSearch.ts`
  - `src/components/candidates/ApolloPreviewSheet.tsx`
  - `src/pages/IndependentCandidateProfile.tsx` (uses hard `window.location.href` to other legacy URLs)
- This explains why users can still land on that old screen: as long as `"/candidates/:candidateId"` renders the old page, any lingering deep link opens it.

Implementation approach
1) Convert legacy page route into a compatibility redirect (not a UI page)
- Keep route path `"/candidates/:candidateId"` for backward compatibility.
- Change its behavior to immediately redirect to:
  - `/candidates?openCandidate=<candidateId>`
- This guarantees that even if any stale/old link is clicked, user lands on the modern candidates page + sheet flow.

2) Keep and harden the query-param sheet-open behavior
- `IndependentCandidateTable` already reads `openCandidate` and opens the sheet.
- Tighten this logic so it only runs for a non-empty value and does URL cleanup safely.
- Ensure no accidental re-open loops.

3) Migrate remaining internal links away from legacy URL format
- Replace all internal `"/candidates/:id"` links with `"/candidates?openCandidate=:id"` in:
  - `CandidateTable.tsx`
  - `SourcingCandidateCard.tsx`
  - `BookingDetailsDialog.tsx`
  - `useGlobalSearch.ts`
  - `ApolloPreviewSheet.tsx`
- This removes dependence on compatibility redirect over time and keeps behavior consistent everywhere.

4) Optional cleanup phase (safe deprecation)
- After all internal links are migrated and validated, we can retire old full-page `IndependentCandidateProfile` UI code.
- For safety, I recommend keeping only a tiny redirect component/file for external backlinks/bookmarks.

Files to update
- `src/App.tsx`
  - Route element for `"/candidates/:candidateId"` should render redirect behavior instead of legacy profile UI.
- `src/pages/IndependentCandidateProfile.tsx`
  - Replace heavy legacy UI with redirect-only logic (or introduce a new lightweight redirect component and route to that).
- `src/components/candidates/IndependentCandidateTable.tsx`
  - Keep current `openCandidate` auto-open flow, add small guard hardening.
- `src/components/candidates/CandidateTable.tsx`
  - Update independent candidate links.
- `src/components/sourcing/SourcingCandidateCard.tsx`
  - Update “View Profile” navigation target.
- `src/components/booking/BookingDetailsDialog.tsx`
  - Update fallback candidate profile link.
- `src/hooks/useGlobalSearch.ts`
  - Update candidate result route.
- `src/components/candidates/ApolloPreviewSheet.tsx`
  - Update navigate fallback for independent candidates.

Expected user-visible result
- Clicking any candidate-related notification/link will no longer show the old legacy full page.
- Users consistently land in the modern experience (Candidates page with profile sheet opened).
- Existing bookmarks to `/candidates/<id>` still work by redirecting seamlessly.

Technical notes
- Use `navigate(target, { replace: true })` in redirect logic to avoid polluting history.
- Keep query param cleanup after auto-open so refresh doesn’t repeatedly trigger.
- Avoid full page reloads (`window.location.href`) for this flow to preserve SPA behavior.

Validation checklist (end-to-end)
1. Click notification bell item -> lands on `/candidates` and opens sheet for the correct candidate.
2. Manually visit `/candidates/<id>` -> immediately redirected to `/candidates?openCandidate=<id>` and sheet opens.
3. Open candidate via global search, sourcing card, booking dialog, and candidate table -> all open modern sheet.
4. Refresh after sheet opens -> no repeated auto-open loop.
5. Confirm no horizontal/vertical scroll regressions in notification popover after these navigation changes.
