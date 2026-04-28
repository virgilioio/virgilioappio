## Multi-interviewer correctness: profile preview + scorecard completion

### Problem

When a stage is configured with **2+ interviewers** (group / AND booking), the app stores:
- One row in `scheduled_bookings` with the **primary** `interviewer_id`
- One row per interviewer in `scheduled_booking_attendees` (`booking_id`, `user_id`, `role='interviewer'`)

That second table is correctly populated by `create-booking` but is **read by almost nothing**, so the rest of the app behaves as if there is only one interviewer. Two concrete symptoms the user reported:

1. **Candidate profile event preview** (`StageBookingsList`, `BookingDetailsDialog`) shows a single avatar + name + confirmation badge — the second interviewer is invisible.
2. **Scorecard completion is per-interviewer**, but the rest of the app treats "any one scorecard exists" as done:
   - Kanban candidate card flips to "Needs Decision" the moment one of two interviewers submits.
   - Pipeline status sort (`usePipelineCandidateStatuses`) does the same — clears "Pending Scorecard" too early.
   - Dashboard "Pending Scorecards" task list (`usePendingScorecards`) only ever surfaces the primary interviewer; secondary interviewers never see their own pending task.

### Source-of-truth rule (to apply everywhere)

For a booking `b`:
- `expected_scorecard_user_ids = scheduled_booking_attendees.user_id where booking_id = b.id and role='interviewer'`
- If `attendees` is empty (legacy / single-interviewer bookings) → fall back to `[b.interviewer_id]`
- A booking is "fully scored" only when `job_stage_scorecards.created_by` covers **every** id in that set (matched by `association_id` + `stage_instance_id` + `is_ai_draft=false`).
- Per-user pending: a user owes a scorecard if they're in `expected_scorecard_user_ids` AND they have no row in `job_stage_scorecards` for that assoc+stage authored by them.

This matches what `create-booking` already inserts and what `usePendingScorecards` half-does today.

### Changes

**1. `src/hooks/useStageBookings.ts`** — fetch attendees alongside the booking; expose `attendees: { user_id, profile }[]` on each returned row. One extra query: `from('scheduled_booking_attendees').select('booking_id, user_id, role').in('booking_id', bookingIds)`, then merge profiles into the existing profile map (extend the `interviewerIds` set with all attendee user_ids before the profiles fetch).

**2. `src/components/candidates/StageBookingsList.tsx`** — when `attendees.length > 1`, render an avatar stack + a vertical list of "Name · ConfirmationBadge" rows under "Interviewers ({n})" instead of the single-avatar header. For single-interviewer (or legacy bookings with no attendees), keep the current layout. Also surface scorecard progress badge: "Scorecards: 1/2 submitted" using the same expected-set logic (small query for `job_stage_scorecards` filtered by association+stage, count of distinct `created_by` ∩ expected set).

**3. `src/components/booking/BookingDetailsDialog.tsx`** — same treatment: list all attendees with their individual confirmation status (today only `interviewer_confirmation_status` exists at the booking level, which is fine to keep showing for the primary; secondary attendees show as "Invited" until per-attendee status is tracked — out of scope for this fix). Use the attendees list for display only.

**4. `src/hooks/usePipelineCandidateStatuses.ts`** — change the "fully scored" check:
  - Also fetch `scheduled_booking_attendees` for the bookings retrieved.
  - Build `expectedByAssocStage: Map<assoc:stage, Set<user_id>>` from the most-recent completed booking per assoc+stage (attendees if present, else `[interviewer_id]`).
  - Build `submittedByAssocStage: Map<assoc:stage, Set<created_by>>` from scorecards.
  - `hasScorecard` (used for "Needs Decision") becomes `expected.size > 0 && expected ⊆ submitted`.
  - "Pending Scorecard" still triggers on completed interview present, but only when the expected set is **not yet fully covered**. (Today the code already treats those as mutually exclusive via `continue`.)

**5. `src/components/jobs/CandidateCard.tsx`** — same fix in the inline `candidate-status` query: fetch attendees for the bookings in this stage, compute expected user-id set, fetch `created_by` from scorecards (not just count), require full coverage before flipping to "Needs Decision". Optional: badge label can become "Pending Scorecard (1/2)" when partially submitted — keeps the user informed without a new variant.

**6. `src/hooks/usePendingScorecards.ts`** — generate one pending row per (booking × expected interviewer) instead of per booking:
  - After fetching past bookings, fetch `scheduled_booking_attendees` for those `booking_id`s.
  - For each booking, expected user-ids = attendees[booking.id] ?? [booking.interviewer_id].
  - Skip non-admin's pending task only if `user.id` is not in the expected set (admins still see all).
  - Existing `scorecardKeys` already keys on `created_by`, so a row stays pending per interviewer until that specific interviewer submits.
  - The `rescheduledKey` future-booking check should be relaxed to `assoc:stage` level (any future booking for the same assoc+stage cancels the pending task for everyone), since rescheduling replaces the whole interview, not per-interviewer.

### Out of scope (call out, don't ship)

- Per-attendee `interviewer_confirmation_status` (today there's a single column on `scheduled_bookings`). Adding one would need a column on `scheduled_booking_attendees` + writes from the calendar sync function. Worth a follow-up if confirmation tracking matters per interviewer.
- AND-vs-OR semantics. Today every attendee row is treated as required. If we ever introduce "optional" attendees for scorecards, the expected-set query needs a role/required filter.

### Verification

1. Stage with 2 interviewers, schedule a group interview → candidate profile shows both avatars + names; both rows appear under "Pending Scorecards" on each interviewer's dashboard.
2. One interviewer submits a scorecard → Kanban card stays on "Pending Scorecard" (or shows "1/2"); other interviewer still has the pending task; pipeline sort still treats it as Pending Scorecard.
3. Both submit → card flips to "Needs Decision"; pending tasks disappear for both.
4. Single-interviewer stage (no attendees rows) → behavior unchanged (fallback to `interviewer_id`).
5. Reschedule a multi-interviewer booking → all per-interviewer pending tasks for the old booking clear (assoc+stage future-booking check).

### Files touched

- `src/hooks/useStageBookings.ts`
- `src/components/candidates/StageBookingsList.tsx`
- `src/components/booking/BookingDetailsDialog.tsx`
- `src/hooks/usePipelineCandidateStatuses.ts`
- `src/components/jobs/CandidateCard.tsx`
- `src/hooks/usePendingScorecards.ts`

No DB migrations and no edge function changes — `create-booking` already writes `scheduled_booking_attendees` correctly.