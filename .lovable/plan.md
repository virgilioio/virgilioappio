## Problem
When a candidate is rejected, `useRejectCandidate` iterates every active (`confirmed`/`rescheduled`) booking for that candidate+job and calls the `cancel-booking` edge function. That flips their status to `cancelled` — including bookings whose `scheduled_end` is already in the past. The Calendar page filters out cancelled events (`e.raw.status === 'cancelled'`), so interviews that already occurred disappear from the grid once the candidate is rejected.

## Fix
Scope the auto-cancellation to **future** bookings only. Past interviews actually took place and should remain on the calendar and in history untouched.

### Change
In `src/hooks/useRejectCandidate.ts`, the query that fetches active bookings for cancellation:

- Also select `scheduled_end` (currently only `id` is selected).
- Before invoking `cancel-booking`, filter the list to bookings where `scheduled_end > now()`.

That's the only change — no edge function edits, no calendar edits, no schema changes. The auto-cancel-on-rejection behavior stays exactly the same for upcoming interviews (see `mem://features/scheduling/auto-cancellation-lifecycle`), just no longer retroactively wipes past ones.

## Verification
- Reject a candidate who had a past interview earlier this week → past event still appears on Calendar with its original status (`confirmed`/`completed`/etc.).
- Reject a candidate with an upcoming interview → that future booking is still auto-cancelled as before.
- Reject a candidate with a mix of past + future bookings → only the future ones get cancelled.

## Files touched
- `src/hooks/useRejectCandidate.ts` (select `scheduled_end`; filter to future before cancelling).
