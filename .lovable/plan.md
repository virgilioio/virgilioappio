# Fix: client board says "moved on" and dossiers aren't ready

## What's happening
When a client opens a candidate, the board fetches their Gio Fit dossier. If there isn't one, the board shows a catch-all toast, "This candidate has moved on from this stage", and sends the client back.

Gio Fit already runs on its own for some candidates: people who apply through the careers page, arrive from a job board, or are picked from Suggested. It doesn't run on its own for everyone else, such as candidates added by hand, imported from a spreadsheet or merged as duplicates. Those candidates stay without a dossier until someone opens their Gio Fit tab. I haven't confirmed yet which candidates on your board are missing one; step 1 checks that.

## Plan
1. **Confirm the gap.** List the active candidates in open jobs who are in the first recruiting stage or later and have no Gio Fit yet, and check that the failing "Awaiting your review" cards are among them.
2. **Gio Fit runs for every candidate who enters the process.** Every time a candidate joins a job or moves into a recruiting stage without a Gio Fit, they're put in a waiting line to be assessed. A background job works through the line a few candidates at a time, so the dossier is ready before anyone opens it. This covers every way a candidate can arrive, not just applications.
3. **Catch up on existing candidates.** Everyone found in step 1 goes into the same waiting line, so their dossiers get generated too.
4. **A clearer screen while one is still being prepared.** If a client opens a candidate before their Gio Fit is ready, they'll see the profile, experience and skills with "Assessment in progress" in place of the score, instead of being bounced back. Their Request interview / Not a fit buttons still work.
5. **"Moved on" only when it's true.** The toast appears only when the candidate has actually left the stages the client can see.
6. **Verify** on the test board: every "Awaiting your review" card opens with a full dossier. Then turn the test link off.

## Technical details
- New `fit_analysis_queue` table: association_id unique, status, attempts, last_error, with grants and service-only RLS. A trigger on `job_candidate_associations` (insert, or `current_stage_id` change into a non-application stage) adds a row when `ai_fit_analysis` is null. The table also holds a lease lock and a paused state.
- New scheduled edge function `process-fit-queue`, run every minute by pg_cron. It takes a single-flight lease, handles at most 5 items per run one after another, and calls the existing `analyze-candidate-fit` (GPT-5.1, no change to how it works). 202 deferrals stay in the queue for a later run. On 402/403 or repeated 429 it pauses the queue and records why. Each item is marked done as it completes.
- Deduplication: skip associations the existing trigger paths are already assessing. The unique key plus a check for a recent analysis stop anything from being assessed twice.
- `dossier-public` `internal_resolve`: return `state:"no_assessment"` with the client-ready payload and no score. `pipeline-public` passes it through and returns `{state:"gone"}` for a missing slug. `PublicDossier` shows the no-score version and calls `onGone` only for `gone`.
- The public `/d/:token` behaviour stays the same. No dossier schema changes.
