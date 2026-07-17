## Shipped scope

**Layer 1 — Attendee details visibility (3 states per field)** + **Layer 2 — Attendee-only edit** + **quiet Gmail-typo hint** on the public form. No auto-reconcile.

---

## Layer 1 — "Attendee details" block

Location: inside the **Next event tile** on `CurrentStageCard` and inside `ScheduleInterviewSheet` when opened in reschedule mode.

Data source: existing `scheduled_bookings` row (`candidate_name`, `candidate_email`, `candidate_phone`, `notes`) matched against `candidates.email` / `candidates.phone` (and any additional contact-phone entries) for the same candidate.

### Per-field state machine

For **email** and **phone** independently, compute one of three states after trim + case-insensitive compare (phone uses E.164 normalized compare):

| State | Trigger | Visual | Actions |
| --- | --- | --- | --- |
| **Match** | booked == profile (non-empty) | quiet row, single value, subtle green check | none |
| **Profile empty** | profile is null/empty, booked has value | neutral "Not on profile yet" hint, single value | **Save to profile** → writes `candidates.email` / adds phone to `candidates.contact_phones` |
| **Differs** | both non-empty, values don't match | amber caution row, both values stacked with clear labels ("Booked" / "On profile") | **Use booked value** (overwrites profile) / **Keep profile value** (no-op, dismisses banner for that field) |

Name is display-only (no state). Notes render as a collapsible "Notes from candidate" below the fields when present.

### Email-only extra action

Regardless of state, when `booked email` is present, expose a small **"Edit attendee email"** trigger on that row → opens the Layer 2 editor (see below). This is the entry point even in the Match case (e.g. candidate's real email changed after booking).

### Save-to-profile / Use-booked-value writes

- **Email:** update `candidates.email` for the candidate row.
- **Phone:** append to `candidates.contact_phones` array as a `{ type: 'mobile', number }` entry (or replace the primary if one exists and the recruiter chose Use booked value). Reuse the same normalization the profile edit path already uses.
- Invalidate the candidate query key so the profile Contact Information card reflects immediately.
- Toast: "Profile updated."

### No writes to the booking row from Layer 1

Layer 1 never mutates `scheduled_bookings`. It only reads from the booking and (optionally) writes to `candidates`. This keeps calendar state untouched unless the recruiter explicitly enters Layer 2.

---

## Layer 2 — Edit attendee email (calendar-only)

Trigger: "Edit attendee email" from the Layer 1 email row, and mirrored as an entry in the Next event tile `...` menu.

### UI

A compact inline editor (popover or a small dialog anchored to the tile — reuse the brand centered dialog pattern if popover feels cramped):
- Current attendee email (read-only, monospace) 
- New email input (validated by zod `email()`, same 255 max as booking form)
- Primary button: **Update invite & resend**
- Secondary: Cancel
- No checkbox, no additional toggles.

### Backend

New edge function: **`update-booking-attendee`** (`verify_jwt = false`, in-code JWT check like `create-booking`).

**Input:** `{ booking_id: uuid, new_email: string }`

**Steps:**
1. Auth: extract user from JWT, verify tenant access to the booking row via existing tenant scoping (mirror `cancel-booking`).
2. Validate `new_email` with zod; reject if unchanged (case-insensitive).
3. Load the booking: `id, tenant_id, candidate_email, google_event_id, calendar_identity_id, scheduled_start, scheduled_end, meeting_type, custom_meeting_location, candidate_name, stage_name, job_title` (whatever fields the existing confirmation email builder needs — pull from `create-booking`).
4. Google Calendar patch:
   - Fetch the event via the same calendar-identity OAuth path `create-booking` and `cancel-booking` use.
   - Rebuild `attendees[]`: remove the entry matching old `candidate_email`, add `{ email: new_email, responseStatus: 'needsAction' }`. Keep every interviewer / guest attendee as-is.
   - `PATCH` with `sendUpdates=all` so Google emits the corrected invite to the new address and a cancellation to the old one.
5. Update the DB row: `scheduled_bookings.candidate_email = new_email`.
6. Resend our own confirmation email to `new_email` using the same template `create-booking` already uses (`emailTemplate.ts` + candidate confirmation copy). Do **not** re-email interviewers.
7. Return `{ ok: true }`. On Google 4xx/5xx, roll back the DB update and surface the provider error per the CORS/error-surfacing guidance.

**No changes to:** attendees table, group interviewer records, time/duration, meeting link, ICS beyond what Google regenerates.

### Client wiring

- New hook `useUpdateBookingAttendee` (thin wrapper around `supabase.functions.invoke('update-booking-attendee')`).
- On success: invalidate booking query keys used by `CurrentStageCard` and `ScheduleInterviewSheet`, toast "Invite updated and resent to <new email>.", ~2s green flash on the email row.
- On failure: read `FunctionsHttpError.context.text()` and show the provider detail in a destructive toast, unchanged UI.

---

## Layer 3 — Silent Gmail-typo hint (public form only)

In `BookingConfirmationForm`, add a tiny suggestion under the email field, no extra field, no visible "guardrail" chrome:

- Static typo map for common domains: `gnail.com`, `gmial.com`, `gmai.com`, `gmail.co`, `gmali.com`, `hotnail.com`, `hotmial.com`, `yaho.com`, `outlok.com`, etc.
- Trigger: on blur or after 500ms debounce, if the local-part parses and the domain matches a key.
- Render: inline `text-xs text-virgilio-muted` line — "Did you mean **you@gmail.com**?" — the suggested address is a single tap that replaces the field value. Dismisses on next keystroke or acceptance.
- No error styling, no submit block, no consent checkbox. If the recruiter later inspects it via Layer 1, the mismatch flow still catches anything the hint missed.

---

## Files touched

**Frontend**
- `src/components/candidates/profile/CurrentStageCard.tsx` — add Attendee details block + Layer 2 trigger + Next event `...` menu item.
- `src/components/candidates/profile/primitives/` — small new `AttendeeDetailsBlock.tsx` (three-state rows) so both CurrentStageCard and ScheduleInterviewSheet reuse it.
- `src/components/candidates/ScheduleInterviewSheet.tsx` — render the same block in reschedule mode.
- `src/components/candidates/EditAttendeeEmailDialog.tsx` — new small dialog (Layer 2 UI).
- `src/hooks/useUpdateBookingAttendee.ts` — new.
- `src/hooks/` — extend/add helpers to write `candidates.email` and append to `contact_phones` from Layer 1 actions (reuse existing patch paths if present).
- `src/components/booking/BookingConfirmationForm.tsx` — add the silent Gmail-typo hint.
- `src/utils/emailTypoSuggest.ts` — new, static domain-typo map + `suggestDomainFix(email)`.
- `src/utils/phoneUtils.ts` — reuse existing E.164 normalizer for compare; no new util needed unless missing.

**Backend**
- `supabase/functions/update-booking-attendee/index.ts` — new edge function (see spec above).
- No schema migrations. No changes to `scheduled_bookings`, `scheduled_booking_attendees`, or `candidates` structure.

---

## Non-goals (explicit)

- No auto-reconcile of booking → profile.
- No confirm-email field on the public form.
- No changes to how booking tokens / links are generated or resolved.
- No changes to interviewer attendees, meeting time, meeting link, or notification templates beyond a single candidate confirmation resend.
- No new tables, no new columns.

---

## Verification

1. **Match state:** book with the exact profile email → Attendee details row shows quiet check, no actions. Rebook and change casing only → still Match (case-insensitive).
2. **Profile empty:** create a candidate with no email, book via a generic link, submit with a valid email → row shows "Not on profile yet" + Save to profile. Click it → profile Contact card now shows that email. Same test for phone.
3. **Differs:** candidate has `real@gmail.com` on profile, submits booking with `real@gnail.com` → amber row shows both. Use booked value → profile updates to gnail. Keep profile value → banner dismisses for that field, booking untouched.
4. **Layer 2 happy path:** Edit attendee email from Match state → change to a new address → Google event attendee is swapped (verify in Google Calendar UI: old attendee removed, new attendee added, invitation email sent), booking row updated, our confirmation email lands at the new address, old address gets Google's cancellation.
5. **Layer 2 error path:** force a 403 from Google (revoke identity) → DB row unchanged, toast surfaces provider error.
6. **Layer 3 hint:** type `foo@gnail.com` on the public form → inline "Did you mean foo@gmail.com?" appears; tap accepts; no other UI changes; typing `foo@company.com` shows nothing.
7. **Regression:** existing scheduling, rescheduling, cancel, and rejection auto-cancel-future-only flows still behave exactly as before.