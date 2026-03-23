

# Fix Scorecard Deletion 409 Conflict

## Root Cause

Migration `20251201195702` added `draft_scorecard_id UUID REFERENCES public.job_stage_scorecards(id)` to `scheduled_bookings` — with no `ON DELETE` action (defaults to `RESTRICT`). When a user deletes a scorecard that was AI-generated from a booking, the FK on `scheduled_bookings.draft_scorecard_id` blocks the delete.

The `deleteMyScorecard` function already handles `scorecard_question_responses` (which has `ON DELETE CASCADE` anyway), but doesn't account for `scheduled_bookings.draft_scorecard_id`.

## Fix

**Database migration**: Alter the FK constraint on `scheduled_bookings.draft_scorecard_id` to `ON DELETE SET NULL`. This is the correct behavior — if a draft scorecard is deleted, the booking should simply lose its reference, not be deleted or blocked.

```sql
ALTER TABLE public.scheduled_bookings
  DROP CONSTRAINT IF EXISTS scheduled_bookings_draft_scorecard_id_fkey;

ALTER TABLE public.scheduled_bookings
  ADD CONSTRAINT scheduled_bookings_draft_scorecard_id_fkey
  FOREIGN KEY (draft_scorecard_id)
  REFERENCES public.job_stage_scorecards(id)
  ON DELETE SET NULL;
```

No code changes needed — the `deleteMyScorecard` function in `useScorecards.ts` already works correctly once the FK constraint allows the delete.

## Files

| File | Change |
|------|--------|
| New migration | Alter `scheduled_bookings.draft_scorecard_id` FK to `ON DELETE SET NULL` |

