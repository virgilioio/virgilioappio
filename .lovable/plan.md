# Job dashboard: richer, more accurate analysis input

## What happens today

The dashboard does **not** send raw records to the model. It builds one deterministic snapshot (`buildJobSnapshot`) and sends that whole JSON object plus the fired issue rules to the model. So it is a structured summary — fairly detailed on pipeline shape, thin on everything else.

What is included now: job basics (title, status, days open, budget, target fill date, must-have skills, location), candidate counts by status, source mix, per-stage counts with each active candidate's name and days in stage, rough stage conversion, movement velocity (7/14 days), salary/location/skills composition, scorecard counts plus 8 recent overviews (trimmed to 240 characters), and interview totals.

What is missing entirely: emails and reply behaviour, notes and comments, rejection reasons, offer records and approval state, scorecard question-level answers, interview cancellations/reschedules/no-shows, job priority, recruiter/owner assignment, application-form responses and job-board performance, reference checks, automations, and any comparison against the workspace's other jobs or against this job's own history.

## Accuracy problems worth fixing

- Rejections are attributed to `current_stage_id`, so a rejection is counted against wherever the candidate sat, not the stage they were rejected from. `stage_conversion.entered` is an approximation, not a measured count.
- Salary comparison drops every candidate whose currency or period differs from the budget, even though the workspace already stores conversion rates. Coverage looks worse than it is.
- Location matching is a naive substring test against one job location field, ignoring additional locations and remote/hybrid nuance.
- Must-have skill matching is exact string equality, so "React.js" misses "React".
- Activity windows are hard-capped at 14 days and scorecards at 100 rows; long-running jobs get truncated history.
- Every active candidate name is inlined per stage with no cap — a 400-candidate pipeline sends a very large payload and the useful signal gets diluted.

## Plan

### Phase 1 — correctness of what we already send
Rewrite the affected sections of `snapshot.ts`: attribute rejections to the stage recorded in stage history, measure real stage entries from history, normalise salaries through the existing currency rates before comparing, fuzzy-match skills (normalised + standardized skills + common aliases), and widen location matching to primary plus additional locations with work-mode awareness.

### Phase 2 — new facts the model should see
Add to the snapshot: job priority and assigned recruiter/hiring team, rejection reasons grouped by category, offer state (created, sent, approval pending/blocked, accepted, declined), interview reliability (cancellations, reschedules, candidate no-shows), communication signals (outbound emails, replies, median time to first reply, stale-no-reply counts), scorecard question-level ratings and the panel-decision picture, reference-check state, and application funnel numbers per posting and per job board.

### Phase 3 — comparison, which is where real insight comes from
Two additions: a small benchmark block comparing this job to the workspace's other jobs of similar seniority/function (median days per stage, conversion, time to hire), and a trend block derived from stored `job_briefings` snapshots so the model can say "conversion at screening halved in two weeks" instead of only describing the present.

### Phase 4 — payload discipline
Keep the payload dense rather than long: cap per-stage candidate lists (longest-waiting N per stage, with a residual count), drop candidate names in favour of a stable initial + id reference, and move raw text (scorecard overviews) behind a fixed budget. Then extend the system prompt to name the new blocks and add issue rules for the new signals so the narrative stays evidence-bound.

## Technical notes

- Files: `supabase/functions/_shared/jobBriefing/snapshot.ts` (main), `detectors.ts` (new rules), `generate-job-briefing/index.ts` (prompt + payload assembly), plus a new benchmark/trend helper under `_shared/jobBriefing/`.
- New queries hit `email_logs`, `rejection_reasons`, `offer_letters`, `offer_approval_requests`, `scheduled_bookings`, `scorecard_question_responses`, `reference_requests`, `job_posting_application_fields`/`candidate_application_responses`, `job_assignments`, and `job_briefings` for history. All batched with chunked `in()` lookups, matching the existing pattern.
- The snapshot hash keeps working as the cache key; new fields simply participate in it, so richer data invalidates stale briefings automatically.
- No frontend change is required for Phases 1-3; the dashboard renders whatever the briefing returns. Phase 4 touches only the prompt and payload, not the UI.
