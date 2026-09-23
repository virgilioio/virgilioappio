# Calendar · Interviewer colours, drag-to-reschedule & event actions

Everything lands on the Calendar page (week view) plus one new backend action endpoint. Nothing outside the calendar changes.

## 1 · Colour by interviewer

- Interviews and holds take the colour of the person running them (the host). Your own always show in brand purple, whatever colour you were assigned.
- Six-colour palette (you/purple, blue, yellow, green, pink, teal), assigned to each workspace member in a stable order and stored on their membership so the colour never shuffles. New members get the next free slot, cycling after six.
- Interview: tinted background with a 3px left edge in the host colour. Hold: white with a dashed border in the host colour (dashed still means tentative).
- Debriefs move off amber to a slate grey (so they don't read as "yellow person"), in week view, day view and the type pill.
- Type pills: Interviews gets a solid purple outlined square, Holds a dashed one — fill colour now means a person, not a type.

**People filter** replaces the static People control: a `People · All | Mine | Name` button opening a 220px menu with Mine, All people (new default), then every member with their colour swatch, name (`(you)` for you) and their event count. The choice is remembered per person in the browser.

**Legend row** between toolbar and grid, shown only when two or more hosts are visible: `Colour = interviewer` plus a pill per visible host. Clicking a pill isolates that person, clicking again returns to All. Right side: `Drag an event to reschedule`.

**Popover:** the candidate's name becomes a purple underlined link to their in-job profile for that job (Cmd/Ctrl-click opens a new tab); "View candidate" goes to the same place. Someone else's event gains a first line with their swatch: `Scheduled by you for Tom Bell` or `Tom Bell's interview`.

**Overlaps:** overlapping events already share lanes; lanes become exact equal widths with 3px gutters so nothing covers anything.

## 2 · Drag to reschedule

- You can drag interviews, holds and debriefs that haven't started. External/busy blocks and anything past can't be dragged and say why in a toast.
- Snaps to 15 minutes vertically and whole days horizontally, clamped to 8:00–18:00 and Mon–Fri of the week on screen. Length is preserved. A 5px movement threshold keeps a click a click.
- While dragging: the original dims, a dashed ghost with the new time label follows the snapped slot, the target day tints, past time shows a faint hatch, and dropping in the past turns the ghost red and refuses with a toast.
- A valid drop does not move the event yet — the ghost holds the new slot and the Move dialog opens. Confirm applies; Undo move, Esc or clicking the backdrop reverts.

## 3 · Ellipsis menu on events

Small ellipsis button at each event's top-right: appears on hover, stays while selected or open, always visible on touch, never starts a drag. 208px menu anchored below (flipping above near the grid bottom), destructive items in red.

- Upcoming interview/debrief: Reschedule… · Resend invite… · Copy meeting link · View candidate · Cancel…
- Upcoming hold: Confirm slot… · Resend slot options… · Reschedule… · Release hold…
- Past: Rebook… · View candidate
- Busy: Open in Google Calendar + a note that it must be edited there

Popover buttons (Join, Reschedule, Confirm slot, Release, Open notes) call the same handlers.

## 4 · One action dialog

A single `CalendarActionDialog` with modes move · reschedule · resend · confirm · cancel: 460px, icon tile (purple, red for cancel), title and `{event} · {job}` sub-line.

- move: From → To strip, old time struck through, new time bold.
- reschedule/rebook: day select (past days disabled), 15-minute start select 8:00–17:45, read-only end.
- resend/confirm: the current slot shown in a strip.
- cancel: reason select, plus a default-on "Return candidate to Needs scheduling" checkbox for interviews; confirming puts them at the top of the right rail tagged `just now`.
- Validation: blocking red notice for a start in the past or an unchanged slot; non-blocking amber notice when the new slot overlaps someone on the panel or your own busy time.
- Recipients: default-on checkbox cards for `Candidate · name` and `Interviewer(s) · names` with emails; debrief cancel defaults candidate off; no candidate row when there is none. Optional message textarea appears once someone is checked.
- Footer notes that Google Calendar updates for everyone, with the primary label reflecting the choice (`Move & send update` / `Move without notifying`, `Reschedule & send update`, `Resend`, `Confirm & send invite`, red `Cancel interview` / `Release hold`).

## 5 · Backend — Google Calendar

One new endpoint handles every confirmed action: it loads the booking and the host's Google connection (falling back to the scheduler's with a warning), patches or deletes the Google event (new times, Meet link on confirm, re-send on resend, delete on cancel/release), notifies exactly the groups that were ticked — Google's own invitations when both are ticked, Gio's branded email when only one is — attaches an ICS with the same identifier, updates the booking, writes a candidate activity entry, optionally returns the candidate to Needs scheduling, and rolls the database change back if Google fails.

Frontend applies the change immediately and shows a spinning "Syncing to Google…" line on the event until it resolves; on failure it reverts with a red toast and Retry. Inbound Google changes already flow in through the existing watch/webhook path; the calendar also refreshes live when bookings change.

Permissions: you can drag and act on events you host or booked; admins on anything. On other people's events the menu offers only View candidate / Open in Google Calendar, and dragging is disabled with a tooltip naming the owner.

## 6 · Toast + undo

Dark toast at the bottom centre of the calendar, gone after 6.5s, saying what happened and who was told (`Moved to Thu Jun 11 · 14:00–15:00` / `Update sent to candidate and 2 interviewers · Google Calendar updated`, `No one notified · Google Calendar updated`). Everything except resend offers Undo, which runs the inverse action and confirms `Change undone · Original invite restored`. Copy link, Join, View candidate and Open in Google get simple confirmations.

## Technical notes

- Files: `src/pages/Calendar.tsx` (colours, People filter, legend, lane widths, drag layer, ghost, hatch, event menu, toast); new `src/components/calendar/CalendarActionDialog.tsx`, `EventMenu.tsx`, `CalendarToast.tsx`, `src/lib/calendar/colors.ts` (palette + host colour resolution), `src/hooks/useWorkspaceCalendarMembers.ts`, `src/hooks/useCalendarEventAction.ts`.
- Data mapping: the booking table is `scheduled_bookings`; host = `interviewer_id`, scheduled-by = `booked_by`, Google ids = `google_event_id` / `candidate_google_event_id` / `ics_uid`, Meet = `google_meet_link`. No renames.
- Migration: add `calendar_color_index` (smallint) to `members` with a backfill assigning stable indexes per tenant by join order, and a trigger assigning the next free index on insert. No other schema change.
- New edge function `calendar-event-action` (verify JWT in code, Zod-validated body, host-or-admin permission check) reusing `_shared/googleCalendarAuth.ts` for tokens and the existing email/ICS helpers used by `cancel-booking` / `create-booking`; activity entries via the existing activity logger.
- Overlap warnings in the dialog are computed client-side from the bookings already loaded.
- Realtime subscription on `scheduled_bookings` inside a `useEffect` with channel cleanup.
- Verification: unit-test the palette/lane maths, typecheck and build, then walk the week grid in a browser for drag, ghost, dialog, menu and toast states. The Google round-trip can only be confirmed against a real connected calendar, so I'll report that step's result rather than assume it.
