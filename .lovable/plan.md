## Fixes for Dashboard "Your queue" card

Scope: `src/pages/Dashboard.tsx` and `src/hooks/usePendingActivities.ts`. Frontend/data-shape only — no schema changes.

### 1. Checkbox doesn't persist as "done"

Today `doneIds` lives only in local React state, so refreshing the dashboard brings every task back. Additionally, only "reply" rows try to persist anything (marking the email read).

Fix:
- Persist `doneIds` per-user in `localStorage` (key like `dashboard.queue.dismissed.<userId>`) so a checked row stays crossed-off after refresh.
- Store as `{ id, dismissedAt }` and auto-expire entries older than 7 days so the store doesn't grow forever.
- Keep the current optimistic behavior for `reply` rows (mark `email_logs.is_read = true`), but also make sure the mutation errors are logged so a silent RLS failure is visible in the console.
- Filter dismissed items out of the visible queue (and out of the tab counts) so the "done" state is coherent after reload, not just a local strike-through that resets.

Note: this is a UI-level dismissal — it doesn't complete the underlying task (scorecard, decision, application). We're only honoring the user's intent to hide it from their queue, which matches what the checkbox visually implies today.

### 2. Reply tasks open the Jobs page, not the candidate profile at the reply

Root cause: reply items are built from `email_logs`, and `email_logs.job_id` is frequently `null` for inbound candidate emails. The current href is `/jobs/${jobId}?candidate=...&tab=communications` — with an empty `jobId` this navigates to `/jobs/` (the list) and the `tab` param is never consumed by `JobDetail` anyway.

Fix:
- In `usePendingActivities.fetchUnreadEmails`, when an email has no `job_id`, look up the candidate's active job association (via `job_candidate_associations` filtered to `status = 'active'`, most recent) and use that `job_id` + title to hydrate the activity. Fall back to the standalone `/candidates/:candidateId` route if none exists.
- Update `buildQueue` in `Dashboard.tsx` so reply rows navigate to `/jobs/${jobId}/candidates/${candidateId}?tab=communications` (the real candidate profile route) instead of the job page. When no job is resolvable, use `/candidates/${candidateId}?tab=communications`.
- Wire the `tab=communications` param in the candidate profile sheet so it selects the Communications/Emails tab on open (mirroring the existing `open=scorecard` handling). The `IndependentCandidateProfile` already reads `tab` from search params — we replicate the same read inside `CandidateProfileSheet` / `JobDetail`'s profile opener.

### 3. Most rows show "Unknown Job"

Same root cause as #2 for reply rows: `email_logs.job_id` is null, so `(email.jobs as any)?.title` falls back to `'Unknown Job'`. For decision/scorecard/application rows the job is already joined via `job_candidate_associations`, so those should be fine — but if any show "Unknown Job" it's because the join returned null (e.g. deleted job). The same association-based fallback used in fix #2 covers the reply case here too.

Fix:
- After the association lookup above, populate `jobId` and `jobTitle` from the resolved association before returning the activity. If we still can't resolve one, tag the row as "No job" (neutral) rather than "Unknown Job" so it doesn't read like a bug.

### 4. Remove the trailing avatar

In `QueueRow` (right side of the row, after the urgency badge) there's a 22px purple initials circle that's purely decorative.

Fix:
- Delete the avatar `<div>` block from `QueueRow`.
- Delete the matching skeleton circle in `QueueSkeleton` so the loading state stays aligned.
- Leave the type-icon chip (left of the label) untouched — that one carries meaning.

### Technical details

- Files touched:
  - `src/pages/Dashboard.tsx` — persisted `doneIds`, updated `buildQueue` hrefs for reply rows, removed avatar from `QueueRow` + `QueueSkeleton`.
  - `src/hooks/usePendingActivities.ts` — resolve missing `job_id`/`jobTitle` for email activities via `job_candidate_associations`.
  - `src/components/candidates/CandidateProfileSheet.tsx` (small change) — honor `?tab=communications` on open, matching the existing `open=scorecard` pattern.
- No DB migrations, no RLS changes, no new packages.
- Verification: check via preview that (a) checking a row and reloading keeps it hidden, (b) clicking a Reply row opens the candidate profile on the Communications tab, (c) rows show a real job name, (d) the avatar circle is gone and row spacing still looks right.
