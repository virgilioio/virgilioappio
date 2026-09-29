# Fix: client board says "moved on" and dossiers aren't ready

## What's happening
When a client opens a candidate, the board fetches their Gio Fit dossier. If there isn't one, the board shows a catch-all toast, "This candidate has moved on from this stage", and sends the client back.

Gio Fit already runs on its own for some candidates: people who apply through the careers page, arrive from a job board, or are picked from Suggested. It doesn't run on its own for candidates added by hand, imported from a spreadsheet or merged as duplicates. Those candidates stay without a dossier until someone opens their Gio Fit tab.

## Scope (to keep cost down)
- Only jobs with a **live client pipeline view** are included. Every other job and every other candidate stays exactly as it is now.
- **When a client view is turned on**, or a stage is added to it: Gio Fit is prepared once for the candidates currently in the stages the client can see who don't have one yet. Nobody else is assessed.
- **While the view is live**: a candidate who joins the job or moves into a stage the client can see gets a Gio Fit automatically if they don't have one yet.
- Candidates who already have a Gio Fit are never assessed again.

## Plan
1. **Confirm the gap** on your live test board: check that the failing "Awaiting your review" cards are the candidates with no Gio Fit.
2. **Automatic preparation**, following the scope above, through a waiting line that works a few candidates at a time.
3. **A clearer screen while one is still being prepared.** If a client opens a candidate before their Gio Fit is ready, they'll see the profile, experience and skills with "Assessment in progress" in place of the score, instead of being bounced back. Their Request interview / Not a fit buttons still work.
4. **"Moved on" only when it's true.** The toast appears only when the candidate has actually left the stages the client can see.
5. **Verify** on the test board: turn the view on, confirm the missing dossiers are prepared and every card opens. Then turn the test link off.

## Technical details
- New `fit_analysis_queue` table: association_id unique, status, attempts, last_error, with grants and service-only RLS. It also holds a lease lock and a paused state.
- Items are added to the queue only when all of these are true: the job has a `job_pipeline_shares` row that is public and active, the association's current stage is in `visible_stage_ids`, the association isn't rejected or withdrawn, and `ai_fit_analysis` is null.
  - A trigger on `job_candidate_associations` (insert, or a `current_stage_id` change) adds the candidate to the queue.
  - A trigger on `job_pipeline_shares` (turned public, or `visible_stage_ids` changed) adds the candidates currently in the visible stages.
- The processor wakes when something is added to the queue and turns itself off once the queue is empty, so nothing polls when there's no work. The new edge function `process-fit-queue`:
  - handles at most 5 items per run, one after another, with a single-flight lease;
  - calls the existing `analyze-candidate-fit` (GPT-5.1, no change to how it works);
  - leaves 202 deferrals in the queue for a later retry;
  - pauses the queue and records why on 402/403 or repeated 429;
  - marks each item done as it completes.
- `dossier-public` `internal_resolve`: return `state:"no_assessment"` with the client-ready payload and no score. `pipeline-public` passes it through and returns `{state:"gone"}` for a missing slug. `PublicDossier` shows the no-score version and calls `onGone` only for `gone`.
- The public `/d/:token` behaviour stays the same. No dossier schema changes. Existing data isn't touched.
