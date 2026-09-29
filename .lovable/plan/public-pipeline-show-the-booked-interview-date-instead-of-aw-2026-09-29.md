# Public pipeline — show the booked interview date instead of "Awaiting your review"

## Current behavior (confirmed)
- `pipeline-public` sets each card's `client_stage` to `awaiting` / `requested` / `declined` / `interviewing` — it never looks at `scheduled_bookings`.
- `PublicPipeline.tsx` maps those to labels ("Awaiting your review" etc.) in `CLIENT_STAGE`.
- Internally, `usePipelineCandidateStatuses` + `PipelineStatusBadge` already render a blue "Scheduled" badge with `Today · 16:30` / `Tomorrow · 10:00` / `Thu 11 Sep · 09:30` style labels.

## Change
When a candidate on the public board has a booked interview (status `confirmed` or `rescheduled`) for their current stage, the card shows the booked date instead of "Awaiting your review".

### Edge function — `supabase/functions/pipeline-public/index.ts`
- After fetching live associations, batch-query `scheduled_bookings` for those candidates + their current stage ids, statuses `confirmed`/`rescheduled` (same filter the internal hook uses).
- Per association, pick the upcoming booking (soonest `scheduled_start >= now`); if none upcoming but one is overdue (start passed, still confirmed/rescheduled), use that.
- If a booking exists and there's no client decision yet, emit `client_stage: 'scheduled'` plus `scheduled_day` ("Today" / "Tomorrow" / "Yesterday" / "Thu 11 Sep", en-GB) and `scheduled_time` ("16:30", 24h) — same formatting as the internal badge. Client decisions (`requested`/`declined`) still win over the scheduled label.
- No booking → behavior unchanged (`awaiting` / `interviewing`).

### Public board — `src/pages/PublicPipeline.tsx`
- Add `scheduled` to `CLIENT_STAGE`: blue tone, label rendered as `{scheduled_day} · {scheduled_time}` (fall back to "Scheduled" if missing), with a calendar-check icon if the current badge renderer supports one — otherwise text-only, matching existing badge styling.

## Verify
- Typecheck/build clean; deploy `pipeline-public`; call the board action on the test share and confirm a candidate with a confirmed booking returns `client_stage: 'scheduled'` with day/time, and one without returns `awaiting`.
