# General booking link: per-event URLs and "Add participants"

## What exists today
- Each event type already has its own address (`/schedule/{your-code}/{event-slug}`), and Settings → Booking shows a "Copy direct link" button per event type.
- But on the public page, when a visitor picks an event type from the list, the address bar stays on the general link — so the link they see and could re-share is not the event-specific one. The quick "Share booking link" popover in chat also only offers the general link.
- The booking backend already accepts extra guest emails and adds them to the calendar invite; the public form just never asks for them.

## 1. One URL per event type
- Picking an event type on the public page updates the address to that event's own URL; "Back" returns to the general link. Browser back/forward works as expected.
- Opening an event URL directly keeps working as today (goes straight to the calendar).
- Unknown/deactivated event slug: show the event picker with a quiet "This event type is no longer available" note instead of a blank page.
- Share popover in chat: add a per-event-type list with a copy button for each (alongside the general link).
- Settings → Booking: keep the existing per-event copy button; also show the event URL under each event's name so it's visible at a glance.

## 2. "Add participants" on the public form
- Only on general (non-interview) booking links — never on candidate/job interview links.
- Field under the visitor's own details: type an email, press space, comma, Enter (or paste a list) and it becomes a removable tag — same behavior as the member-invite field.
- Invalid emails are rejected with an inline message; duplicates and the visitor's own email are ignored; limit 10 participants.
- Participants receive the calendar invite with everyone else, and appear on the confirmation screen ("Also invited: ...").

## Technical notes
- `PublicBookingPage.tsx`: picker `onSelect` → `navigate(/schedule/{shortCode}/{slug})`; back → `navigate(/schedule/{shortCode})`; derive `selectedEventType` from `eventSlug` (clear when slug absent) so history works; preserve query string.
- `BookingConfirmationForm.tsx`: new optional `allowGuests` prop (true only when `!hasContextualLink`), renders the shared tag-input (reuse `scheduling/GuestEmailInput` / member-invite chip pattern), zod-validated; pass `guest_emails` to `create-booking`.
- `create-booking`: server-side guard on `guest_emails` — array of valid, lowercase, deduped emails, max 10, ignored for contextual (candidate/job) bookings.
- `BookingLinkPopover.tsx` + `BookingLinkSection.tsx`: per-event copy rows using `${bookingUrl}/${slug}`; active event types only.
- `BookingConfirmed.tsx`: list stored `guest_emails` if present.
