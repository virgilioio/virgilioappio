# Why Luke Harer's Gio Fit re-score hangs — and the fix

## What the logs show

Every recent fit-analysis run in this workspace ended the same way: the request to the AI service was cut off after 60 seconds, retried once, and cut off again. Three consecutive runs failed this way in the last few minutes (20:55, 20:57, 20:58 UTC), each with the same "signal has been aborted" message. Nothing about Luke is malformed — his record is small (one-page summary, 4 roles, 2 qualifications, 11 role skills, 3 scorecards) and the stored score from 29 July is still intact.

So the hang is a timing mismatch, in three layers:

1. **The AI call is set to the slowest possible thinking mode** ("high" effort on our strongest model), and it now also has to judge each of the 11 role skills one by one. That regularly takes longer than 60 seconds.
2. **The 60-second cut-off is a hard ceiling**, and the automatic retry makes it worse: a call that can't finish in 60 seconds can't finish in the retry either, so every failure costs about 2 minutes before anything is reported.
3. **The screen gives up after 24 seconds** of waiting, long before the server finishes either way — so it looks like nothing is happening.

On top of that, because the run never completes, the "score is out of date" condition is never cleared, so the same doomed re-score is offered again on every visit.

## The fix

- Give the fit analysis a realistic time budget (about 150 seconds) instead of the shared 60-second ceiling, and stop retrying a call that was cut off for running long — retry only genuine network errors and service errors.
- Move the analysis to a balanced thinking mode so a normal candidate finishes in well under a minute, keeping the skill-by-skill judgement intact.
- Let the waiting screen keep its narrated progress for the full server budget instead of quitting after 24 seconds, with Cancel still available.
- When a run truly fails or times out, show the existing failure card immediately with a Try again action, rather than silently leaving the "out of date" prompt in place.

The previously saved score, the stored wording and the database stay untouched; a failed or cancelled run never overwrites them.

## Technical notes

- `supabase/functions/_shared/openaiFetch.ts`: accept an optional `timeoutMs` (default stays 60s); track whether the first failure was our own timeout abort and skip the retry in that case, so a slow call fails once instead of twice.
- `supabase/functions/analyze-candidate-fit/index.ts`: pass `timeoutMs: 150_000` for the main scoring call, drop `reasoning_effort` from `high` to `medium` (translation pass stays `medium`), and surface a distinct `timeout` error body so the client can label it.
- `src/hooks/useCandidateFitInsights.ts`: raise the poll loop from 4×6s to cover ~160s (e.g. 26 × 6s) while keeping the abort controller and Cancel behaviour, and map a timeout/failure response to `generationError` rather than `deferred`.
- No migrations, no schema changes, no change to the scoring rubric or weights.

## Verification

- Re-score Luke Harer from the Gio Fit tab and confirm it completes with a score and reasoning, with the narrated loader running the whole time.
- Confirm the edge function logs for that run show a completed call and no "signal has been aborted".
- Cancel a run mid-flight and confirm the previously stored analysis and date are unchanged.
