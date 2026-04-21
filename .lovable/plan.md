

## Multi-interviewer scheduling: AND vs OR

### Goal
Let users assign multiple interviewers to a stage with explicit logic:
- **OR (any of)** — current behavior. Candidate sees a per-interviewer link; only one calendar matters.
- **AND (all of)** — new. Candidate sees a single link whose calendar is the **intersection** of all selected interviewers' availability (a slot is shown only if it's free on every interviewer's Google Calendar and inside every interviewer's working hours).

The choice is configured per stage.

---

### 1. Data model — one new column

Add `interviewer_scheduling_mode` to `job_hiring_stages`:

```sql
ALTER TABLE job_hiring_stages
  ADD COLUMN interviewer_scheduling_mode text NOT NULL DEFAULT 'any'
  CHECK (interviewer_scheduling_mode IN ('any','all'));
```

- `any` = OR (default; matches today)
- `all` = AND (group availability)

No changes to `stage_interviewer_assignments`. Assignment types (`required`/`optional`/`backup`) keep their meaning — in `all` mode, only `required` + `optional` are intersected; `backup` is excluded from the group calendar (still fallback).

`scheduled_bookings.interviewer_id` already exists; for `all`-mode bookings we'll keep the primary (host who owns the booking_config used to send invites) and store the others in a new lightweight join table:

```sql
CREATE TABLE scheduled_booking_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES scheduled_bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'interviewer', -- interviewer | optional | backup
  UNIQUE (booking_id, user_id)
);
```

This is needed so calendar invites and Meet links go to all attendees, and so reschedule/cancel logic can re-check the group calendar.

---

### 2. Stage configuration UI (`TeamTab.tsx`)

Above the interviewer list, add a small segmented control:

```
Scheduling mode:  [ Any of these (OR) ]  [ All together (AND) ]
                  Candidate picks one     Single time that works
                  interviewer's calendar  for everyone
```

- Persists to `job_hiring_stages.interviewer_scheduling_mode`
- When switched to **AND**, show a banner if any selected interviewer doesn't have an active booking config: *"X has no booking link configured — group availability requires all interviewers to have a calendar connected."*

---

### 3. Candidate-side button (`GenerateBookingLinkButton.tsx`)

Logic becomes:

```
if mode === 'any':
  - 0 interviewers with config → fall back to user's own link (today's behavior)
  - 1 interviewer → single button "Copy {Name}'s Link"
  - 2+ interviewers → dropdown to pick one (today's behavior)

if mode === 'all':
  - <2 interviewers with active configs → show warning tooltip, disable
  - else → single button "Copy Group Booking Link"
    Tooltip: "Shows times that work for {Names joined}"
```

The group link routes to a new short code namespace: `/schedule/group/<token>` (the token resolves to the list of `booking_config_ids`). One token per stage+candidate, same TTL as today.

---

### 4. New edge function: `create-group-booking-token`

Mirrors `create-booking-token` but stores `booking_config_ids: uuid[]` instead of `short_code`. Reuses the same `booking_link_tokens` table plus two new columns:

```sql
ALTER TABLE booking_link_tokens
  ADD COLUMN scheduling_mode text NOT NULL DEFAULT 'single',
  ADD COLUMN booking_config_ids uuid[];
```

`scheduling_mode = 'group'` rows have `booking_config_ids` populated and `short_code` null.

`resolve-booking-token` returns the array when present so the public page knows to render the group flow.

---

### 5. New edge function (or mode flag): group availability

Extend `get-booking-availability` with an optional `booking_config_ids: string[]` parameter. When present:

1. Load **all** configs; reject if any inactive.
2. Compute potential slots per config (existing `generatePotentialSlots` per config's effective schedule + timezone + buffer).
3. **Intersect**: keep a slot only if it appears in every config's potential set.
4. Effective `min_notice` = max across configs; effective `max_days_ahead` = min across configs.
5. Fetch Google Calendar busy slots **for each config's user_id in parallel** (existing `check-calendar-availability` per user).
6. Combine: a slot is available only if it's clear on **every** user's calendar AND not already booked in `scheduled_bookings` for any of those configs.

Returns the same response shape; the candidate UI doesn't change.

---

### 6. Public booking page (`PublicBookingPage.tsx`)

When the resolved token is `scheduling_mode='group'`:

- Header shows all interviewer names: *"Interview with Alice, Bob & Carol"*
- Skip the event-type picker (group bookings use a single fixed duration — host's primary config's default; see open question)
- `useBookingAvailability` is called with `booking_config_ids` instead of `booking_config_id`
- Confirmation copy: *"You'll meet with Alice, Bob and Carol"*

---

### 7. `create-booking` edge function

When the request includes `booking_config_ids`:

1. Re-validate the slot is free on **every** calendar (server-side guard against the OR bug pattern we fixed earlier).
2. Insert one `scheduled_bookings` row tied to the **primary** config (the one whose user owns the Google Meet / acts as organizer — first in the list, deterministic).
3. Insert N rows in `scheduled_booking_attendees` (one per interviewer).
4. Create **one** Google Meet event with all interviewers as attendees on the primary user's calendar.
5. Send confirmation emails to candidate + all interviewers.

Reschedule and cancel paths read `scheduled_booking_attendees` to know who to re-invite / re-check.

---

### 8. Files touched

**Schema**
- New migration: add `interviewer_scheduling_mode` column, `scheduled_booking_attendees` table, and `booking_link_tokens` columns.

**Frontend**
- `src/components/jobs/stage-config/TeamTab.tsx` — add mode toggle + warning banner.
- `src/hooks/useStageInterviewerAssignments.ts` — expose `schedulingMode` + setter.
- `src/components/candidates/GenerateBookingLinkButton.tsx` — branch on mode.
- `src/hooks/useStageBookingInterviewers.ts` — add group-token branch (`copyGroupLink`).
- `src/lib/bookingLinkUtils.ts` — `createGroupBookingToken`, `generateGroupBookingLink`.
- `src/pages/PublicBookingPage.tsx` — group-mode rendering path.
- `src/hooks/useBookingAvailability.ts` — accept `bookingConfigIds`.

**Edge functions**
- New: `create-group-booking-token`.
- Update: `resolve-booking-token` (return `booking_config_ids` + `scheduling_mode`).
- Update: `get-booking-availability` (intersection mode).
- Update: `create-booking` (group insert path + multi-calendar re-validation + Meet attendees).

**No changes** to scorecard, transcript, or analytics flows — they read `scheduled_bookings` as today; attendees are additive.

---

### Open questions (please confirm before I implement)

1. **Default mode for existing stages with multiple interviewers** — keep them as `any` (no change in behavior) and let users opt into `all`. Confirm?
2. **Backup interviewers in AND mode** — exclude from intersection (stay as fallback only), correct?
3. **Event types in AND mode** — the host's primary config may have multiple event types; for group bookings I propose using only the primary config's *base* schedule (not event-type overrides) since intersecting per-event-type schedules across multiple hosts gets confusing fast. OK to scope event types as single-host only for v1?
4. **Who is the "primary" / organizer in AND mode** — I'll default to the first `required` interviewer (alphabetically by name as tiebreaker). Acceptable?

