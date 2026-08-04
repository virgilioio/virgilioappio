# Fix: candidate receives two interview invites

## What actually happened

I checked Ana's booking (`65add9de…`, created today 22:16 UTC). There is only **one** booking row — no duplicate scheduling. She still got two invites because `create-booking` produces two independent invite objects that both reach her inbox:

1. **The real Google Calendar invite** — a candidate-only event created on the interviewer's calendar (`candidate_google_event_id`), attendees: Ana only. This is the intended one.
2. **A second invite embedded in the confirmation email** — the "Your Interview is Confirmed" email attaches `interview.ics` with `METHOD:REQUEST` and its own UID (`booking-<id>@gogio.io`). Gmail treats that as a separate invitation.

That attached ICS is a **single shared file** reused for the candidate, the interviewers, and the guests. Its attendee list is built as: candidate + group interviewers + `guest_emails`. On this booking `guest_emails = [steve.agnor@partnershipleaders.com]` (the hiring manager), which is exactly why the second invite Ana saw lists the hiring manager. The ingest address and the booker/coordinator are only attendees on the real Google event, never in the ICS — matching what she reported.

So: one booking, one legitimate Google invite, plus one stray ICS invite that also leaks the internal attendee list to the candidate.

## The fix

In `supabase/functions/create-booking/index.ts`, stop sending the shared internal ICS to the candidate.

1. **Split the ICS into two files instead of one shared `icsBase64`:**
   - `candidateIcs` — attendees: the candidate only. Organizer stays the interviewer.
   - `internalIcs` — the current behaviour (interviewers + guests, candidate included as today), used for interviewer and guest emails. Unchanged for them.
2. **Candidate email:** attach the ICS only when no Google candidate event exists (`candidateGoogleEventId` is null). When Google already sent the real invite, send the confirmation email with **no** `.ics` attachment and adjust the one sentence that says "A calendar invite is attached to this email" to point at the calendar invite they received instead. This removes the duplicate invite in the normal path and keeps a working fallback when Calendar isn't connected or the event failed.
3. **Interviewer and guest emails:** keep attaching `internalIcs` exactly as today.

Nothing else changes: same booking row, same Google event creation, same recipients, same ingest address, same guest handling, same activity logging.

## Technical notes

- File: `supabase/functions/create-booking/index.ts`
  - ICS construction around lines 916–956 → build two attendee lines / two encoded payloads.
  - Candidate send block lines 959–1022 → conditional `attachments`, minor copy tweak.
  - Interviewer block (1064–1129) and guest block (1175–1200) → swap `icsBase64` for `internalIcs`.
- Both ICS files keep the same `ics_uid` (`booking-<id>@gogio.io`) so `cancel-booking` cancellation ICS continues to match.
- Redeploy `create-booking` after the change.
- No database, permission, frontend, or scheduling-logic changes.
