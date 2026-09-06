# Fix "Candidate not found" for candidates outside the loaded list

## What's happening

Esme Oropeza exists and is fine in the database. The problem is how the candidate page finds her.

The candidate page does not look the person up directly. It loads a batch of the 1,000 most recently added candidates for the workspace and then searches inside that batch. Your workspace has 1,732 candidates, and 1,251 of them were added after Esme — so she falls outside the batch and the page concludes she doesn't exist.

The top search bar queries the database directly, which is why she shows up there. Any candidate added before the newest 1,000 will hit the same dead end, so this affects roughly 700 people, not just her.

## The fix

1. When the candidate page opens with an ID, look that one person up directly in the database instead of hoping they're in the loaded batch. Show "not found" only when the direct lookup genuinely returns nothing (or access is denied).
2. Keep the existing batch for the Previous/Next arrows and the counter. When the person isn't in the batch, simply show no arrows rather than an error page.
3. Same treatment for the candidates list opening a profile via a link (`?openCandidate=...`) so a search click always lands on the profile.
4. Leave the browsing list, filters, permissions and all data shapes untouched.

## Technical detail

- `src/pages/IndependentCandidateProfile.tsx` currently derives `candidate` from `useIndependentCandidates()` — a query capped at `.limit(1000)` ordered by `created_at desc` (`src/hooks/useIndependentCandidates.ts:104-111`). Add a dedicated single-record query (react-query, keyed by candidate id) selecting the same `IndependentCandidate` column set, filtered by id, `deleted_at is null`. Prefer the list entry when present (keeps cache behaviour), otherwise use the direct fetch.
- Not-found renders only when the direct fetch has settled with no row; loading state covers both queries.
- Prev/Next: keep `idx` from the list; when `idx === -1`, disable both arrows and hide the "x of y" counter.
- Mirror the same single-record fallback wherever `?openCandidate=` resolves a candidate from the list (`src/pages/Candidates.tsx` / sheet wiring) so the sheet opens for out-of-batch candidates too.
- No schema, RLS, or edge function changes. RLS already scopes the direct lookup to the caller's tenant/org, so no new exposure.

## Note on the wider list

The 1,000-row cap also means the Candidates browsing list itself never shows the oldest ~700 people. That's a separate change (paging or server-side search/filtering) — say the word and I'll plan it next.
