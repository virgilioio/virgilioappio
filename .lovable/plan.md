## Validation — both issues reproduce in production data

### Issue 1 — New applications missing from Dashboard "Your queue"

Data confirms new applications are being placed correctly in `application_review`:

- Most recent applicant `Pablo Sergio Guevara Herrera` (candidate `7e16…cfc0`) was inserted `2026-07-07 15:10:09` for job `Senior Project Manager - Services` with `status = active`, `current_stage_id → stage_type = application_review`, tenant matches your workspace.
- `useNewApplicationsQueue` correctly returns this row (FK name, tenant, RLS, chunking all check out).

But `Dashboard.tsx > buildQueue` gives fresh applications the **worst sort rank in the queue**:

| Type              | Fresh urgency | sortRank            |
| ----------------- | ------------- | ------------------- |
| Scorecard due     | today         | ~1.0                |
| Stage decision    | today         | ~1.5                |
| Reply needed      | today         | ~1.4                |
| **New application** | **normal (day 0)** | **~2.6 (last)** |

`QueueCard` then hard-slices to the first 10 items (`items.slice(0, 10)`). Any workspace with 10+ pending scorecards/decisions/replies pushes today's new applicants completely out of view — which is exactly what the user is seeing. The "Applications" filter chip still shows a count, but on the default "Everything" tab they disappear.

Secondary hardening gaps in `useNewApplicationsQueue`:

- Silently swallows errors per chunk (`if (error) continue`) — a failing RLS/permission error would produce an empty queue with no signal.
- Depends on `useJobs()` (tenant scope). Correct for admins, but restricted viewers who own no assigned jobs get an empty queue even when their org has applications.

### Issue 2 — Only "Location Compatibility" scored on the in-job Fit Dimensions card

Confirmed by comparing DB state vs. AI output for the same candidate:

- Candidate `Pablo Sergio` has full data: 21 skills, 6 work experiences, 3 educations, 14 years exp, current role "SENIOR PROJECT MANAGER", resume attachment — all present in `candidates` / `candidate_work_experience` / `candidate_education`.
- Yet `ai_fit_analysis.dimensions` for the same association shows `score: null` for Skills, Experience, Role & Title, Salary, Company Pedigree, Language — every dimension whose `insight` reads "not provided / unknown / not mentioned". Only `Location Compatibility` = 100 (the one datum captured on the application form itself).
- Same pattern on the other two applicants from today; the one older applicant (`Hugo Sanchez`) analyzed later has full dimension scores — so the pipeline itself works, it's the timing that's wrong.

Root cause is in `supabase/functions/public-submit-application/index.ts` (lines 866–891):

```ts
// Fire-and-forget background AI enrichment (skills + profile summary)
supabase.functions.invoke('enrich-candidate-profile', { … }).catch(…)

// Fire-and-forget: pre-generate AI fit insights   ← runs in parallel
fetch(`${SUPABASE_URL}/functions/v1/analyze-candidate-fit`, …)
```

Both are fired simultaneously. `analyze-candidate-fit` reads the candidate row ~seconds later, before `enrich-candidate-profile` has written skills / work history / years_experience / language, so the LLM legitimately sees nothing and returns `null` on every knowledge-based dimension. Only Location (captured directly from the application form) makes it in.

The other places that trigger the analysis (`useCandidateAssociations.addAssociation`, `useCandidateFitInsights.refreshInsights`) run manually well after enrichment, which is why the bug is invisible for manually-added candidates.

## Fix plan

### A. Dashboard queue — surface new applications

Edit `src/pages/Dashboard.tsx`:

1. In `buildQueue`, give applications an urgency-aligned sort rank that mirrors the other categories so a same-day applicant sits alongside today's scorecards/decisions/replies instead of at the bottom:
   - `overdue` (≥5d) → `-0.3 - d*0.01` (already correct)
   - `today` (≥2d)  → `1.3` (ahead of replies)
   - `normal` (<2d) → `1.7` (right after "today" work, still above 2.4 normal replies)
2. Bump the visible cap from a hard `slice(0, 10)` to a small filter-aware minimum: always guarantee that if `counts.application > 0` at least one application row is shown on the "Everything" tab (implement by reserving the last slot for the top application when the first 10 contains none). Keeps the "See N more" affordance intact.

Edit `src/hooks/useNewApplicationsQueue.ts`:

3. Replace the silent `if (error) continue` with a `console.warn` + accumulator so a broken chunk surfaces in logs (no behavior change on the happy path, just observability).
4. Add a `staleTime: 15_000` + `refetchOnWindowFocus: true` so a candidate applying while the tab is open shows up within seconds without a manual reload.

Out of scope: changing `useJobs()` tenant/assignment scope, redesigning the queue, or the Application Review card — those are separate surfaces.

### B. Fit Dimensions — chain analysis after enrichment

Fix the race at the source, not at every caller.

Edit `supabase/functions/enrich-candidate-profile/index.ts`:

1. Accept an optional `{ job_id }` in the request body (backwards compatible).
2. After enrichment writes complete (skills, work_experience, education, years_experience, language, etc. committed), if `job_id` was provided, `fetch` `analyze-candidate-fit` with `{ candidate_id, job_id }` as a fire-and-forget tail step. Ensures the analysis reads the fully-populated candidate row.
3. Return early with an ignored-`job_id` note if enrichment fails, so we don't run a doomed analysis on empty data.

Edit `supabase/functions/public-submit-application/index.ts` (lines 866–891):

4. Pass `job_id: posting.job_id` in the `enrich-candidate-profile` invoke body.
5. **Remove** the sibling `fetch(analyze-candidate-fit)` block — the enrichment tail now owns the trigger. Keep the log line updated to reflect the new sequencing.

Edit `supabase/functions/analyze-candidate-fit/index.ts` (defense in depth):

6. Add a lightweight data-freshness guard: if `data_sources_used.length <= 1` (i.e., only location present) AND the candidate row was updated in the last 60s, return `202 { status: 'deferred', reason: 'awaiting_enrichment' }` instead of writing a score. Prevents any remaining race — including manual retriggers on chrome-extension / talent-apply-webhook paths — from persisting an empty analysis.
7. When the deferred path returns, do **not** touch `ai_fit_analysis` / `ai_fit_score` (avoids overwriting a good prior score with an empty one).

Client hook changes: none required. `useCandidateFitInsights.refreshInsights` already invalidates on completion and the auto-trigger in `CandidateInsightsTab` will simply see the score arrive when enrichment tail fires.

### Verification

- Run a public application against the current preview using an existing form + resume. Within ~15s: (a) row appears in "Your queue" under "Everything" (top position if no scorecards/decisions today); (b) opening the candidate → Overview → Fit Dimensions shows all 7 dimensions populated (Skills, Experience, Role & Title, Location, Salary, Pedigree, Language), not just Location.
- Re-run `bunx tsgo --noEmit` — must be clean.
- Spot check `supabase.analytics_query` for `function_edge_logs` on `enrich-candidate-profile` and `analyze-candidate-fit` to confirm the new call chain (enrichment invokes fit exactly once, no direct call from `public-submit-application`).
- DB check: newest `job_candidate_associations.ai_fit_analysis` for a post-fix applicant has ≥5 non-null dimension scores.

### Out of scope

- Wizard / edit sheet / posting UI (untouched).
- Queue-widget redesign, dismissal logic, dashboard layout.
- Enrichment prompt tuning or `analyze-candidate-fit` scoring logic.
- Restricted-viewer visibility of applications (separate permissions concern).
