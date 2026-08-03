# Fix candidate profile arrow order (pipeline-faithful navigation)

## What's happening today (verified in code)

- Clicking a candidate card on the pipeline board calls `PipelineOverview` → `onCandidateClick(candidateId, currentOrder)`. That `currentOrder` is a **frozen snapshot of the exact board order** (stage by stage, top to bottom).
- `JobDetail.openPipelineProfile` receives that order, but `openProfileInPlace` immediately does `navigate('/jobs/:id/candidates/:candidateId')` for pipeline/application contexts — so **the order snapshot is thrown away** and the in-place list is never used.
- The route page `src/pages/CandidateProfile.tsx` then rebuilds its own list with `useCandidates(jobId)`, which fetches **every association for the job (active, rejected, hired) ordered by `created_at` descending**. That is the list feeding `hasPrev` / `hasNext`.

Result: the arrows follow "newest added first, all statuses mixed", not the pipeline. And because the list is live, rejecting a candidate re-sorts/re-classifies it and the next arrow lands on rejected candidates instead of where you left off.

## The fix

1. **Persist the board order when opening a profile.** In `JobDetail`, when `openPipelineProfile` gets a `navigationOrder`, store it (candidate-id array + jobId) in `sessionStorage` under a single key (e.g. `gio:candidateNavOrder`) before navigating to the profile route.
2. **Consume that order on the profile page.** `CandidateProfile.tsx` reads the stored order for the current `jobId`:
   - Build the navigation list as `storedOrder` intersected with the candidates it knows about, preserving `storedOrder`'s sequence.
   - Compute `hasPrev` / `hasNext` / `currentIndex` / `totalCount` from that list.
   - The stored order stays **frozen for the session of browsing** — so rejecting the candidate you're on does not reshuffle the list, and "Next" goes to the exact candidate that was next on the board.
3. **Fallback when there is no stored order** (deep link, refresh with no snapshot, entry from the candidates table or Application review): derive an order from the job's stages instead of `created_at`:
   - active candidates grouped by stage in stage order, then within a stage the same order the board uses, followed by non-active (offered/hired/rejected) at the end.
   This keeps arrows pipeline-faithful even without a snapshot.
4. **Refresh the snapshot on new pipeline opens** so navigating back to the board and clicking another candidate captures the current board state again.

## Technical notes

- Files touched: `src/pages/JobDetail.tsx` (write snapshot), `src/pages/CandidateProfile.tsx` (read snapshot + ordered fallback), plus a small helper (e.g. `src/lib/candidateNavOrder.ts`) for reading/writing the snapshot and building the stage-ordered fallback.
- No changes to data fetching shape, mutations, rejection logic, permissions, or the profile sheet UI. `useCandidates` keeps its current behaviour; only the ordering used for arrow navigation changes.
- Snapshot is validated against `jobId` and dropped if it doesn't match, so orders never leak between jobs.
