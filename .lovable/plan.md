
# Candidate Booking Pages — Visual Refresh

Pure aesthetic rework of the three public booking surfaces. **No logic, no data, no routing, no hooks, no edge functions change.** Mockups in `45_General_booking_link.html`, `46_Job_stage_panel_booking.html`, `47_Booking_confirmed.html`.

## Shared chrome (used by all three pages)

Replace the current `GoGioLogo`-only header and missing footer with a shared shell:

- **Header** (sticky, hairline border, cream bg `#FAF8F2`-ish from mockups, with `bg-white`):
  - Left: black rounded "G" tile + `Acme Talent` (Poppins bold) / `Scheduling` (muted) — pull workspace/tenant name from the existing `config` props already loaded; fall back to current `GoGioLogo` text style when missing.
  - Right: green shield icon + "Secure link" · vertical divider · "Powered by **Gio**".
- **Footer** (centered, muted):
  - lock icon + "Your details are never shared publicly" · "Privacy" · "Report this link".

Build as two small presentational components: `src/components/booking/PublicBookingHeader.tsx` and `src/components/booking/PublicBookingFooter.tsx`. Used by `PublicBookingPage.tsx` and `BookingConfirmed.tsx`. Use semantic Virgilio tokens (`virgilio-text`, `virgilio-muted`, `virgilio-border`, `virgilio-purple`) — no raw hex.

## 1. `PublicBookingPage.tsx` — General + Job/Stage layouts

Same surface; differs only by props already wired (`bookingContext`, `selectedEventType`, group flag).

### Centered intro block (replaces current left-aligned greeting + heading)
- Top chip (pill, white, hairline border):
  - General: green dot + `Booking with {Interviewer name}`.
  - Job/stage: `Scheduling for` + small avatar badge + candidate name (purple).
- H1 (centered, Poppins, large):
  - General: `Let's find a time to talk.` (period in `text-virgilio-purple`).
  - Job/stage: `Hi {first} — let's lock in your {stage|onsite}.` Keep existing copy logic, just restyle and center.
- Subtitle (muted, centered, max-w prose):
  - General: `Pick the kind of conversation you'd like, then choose a slot that works for you.`
  - Job/stage: `Pick any time below — these are the slots where your whole panel is free. We'll send a calendar invite with the video link right away.`

### Main panel (one rounded card containing the 3-column grid)
Wrap the existing `lg:grid-cols-[320px_1fr_340px]` grid in a soft outlined panel (`rounded-2xl bg-white border border-virgilio-border shadow-sm p-6 md:p-8`). Drop the per-column `Card`s currently around the calendar and the right column; keep the inner content but unstyled by their old `Card`/`shadow-calendly` wrappers so the panel reads as one surface like the mockups.

### Left column

**General booking** (rework `InterviewerCard.tsx`):
- Big purple avatar (initials, white text).
- Name (Poppins bold) + `{role} · {workspace}` muted line (use existing `display_name`/`description`).
- Meta row: ⭐ `Usually replies fast` · 🌐 `{city}` — render only when corresponding data exists; hide otherwise (no new data fetched).
- Divider.
- `CHOOSE A MEETING TYPE` small caps label.
- Re-skin `EventTypePicker` cards to match: rounded `xl`, hairline border, soft lilac selected state, left icon tile (use event type color), title + duration chip on right, radio dot on far right, description as muted line. Move the `EventTypePicker` out of the `showEventPicker` standalone screen and render it inline in this left column when no `selectedEventType` yet — pure visual move; the existing `setSelectedEventType` handler is reused. When an event type is already selected, render the same card list with the selected one highlighted (does not replace the picker logic, just always-visible).

**Job/stage booking** (new component `JobStageSummaryCard.tsx`, replaces current job-context purple banner + interviewer card on this code path):
- Two pills: `● Onsite · Final round` (purple dot) + `Stage X of Y` (neutral). Pull `stageName` / `jobTitle` from existing `bookingContext`; if stage index/total aren't available, omit the `Stage X of Y` pill.
- Title: `{Stage display title}` (Poppins bold).
- Subtitle: `{Job title}` muted.
- Divider.
- Icon rows: `DURATION` · `{activeDuration} minutes`; `FORMAT` · `Google Meet · link on confirm`; `TO PREPARE` · `{description}` (only render when description present).
- Divider.
- `YOU'LL MEET` caps label + panelists list. Use `groupInterviewerNames` (already loaded for group bookings); each row = colored circular initials avatar + name + role line (role line muted, omit if unknown).
- Green pill banner: `📅 Reschedule anytime up to 12h before.` — static copy, matches mockup; no new logic.

### Middle column (Calendar)

Rework `MonthCalendar.tsx` cells to match the mockup:
- Month header: `June 2026` left, two ghost icon buttons (chevron left/right) inside a small rounded outlined group on the right.
- Weekday header: tiny uppercase muted labels (`MON … SUN`).
- Day cells: square, no background by default; **available** = soft lilac fill (`bg-virgilio-purple/8`) + small purple dot beneath the number; **selected** = solid near-black square with white number; **unavailable / past** = muted text only.
- Below grid: legend row `● Available  ● Selected` using a faint lilac and black dot.
- Drop the Calendly-style horizontal slide of the time-slots panel. Keep both columns simultaneously visible at all sizes (already the case on desktop; just remove the width-collapse transition styling).

Mobile: keep the existing step flow, just restyle cells/header to match.

### Right column (Day + slots)

Rework the slots section (used by `TimeSlotsList.tsx` on desktop, currently inline):
- Header row: `Thursday, June 11` left (Poppins bold), `{N} times` muted right.
- Timezone `Select` restyled as a rounded outlined pill with a globe icon prefix (re-skin only — same `Select` component and same `candidateTimezone` state).
- Optional purple notice pill `👥 All 3 panelists free` — only render on group bookings (reuse `isGroupBooking`).
- Slot buttons stacked vertically, white with hairline border, hover lilac, selected = dark fill + adjacent **Confirm →** purple button to the right (existing `BookingConfirmationForm` confirm pathway). The current selected-then-show-form pattern becomes: when a slot is selected, render the dark slot + an inline `Confirm` button; the existing `BookingConfirmationForm` continues to be the actual confirm UI (kept below the slot list or shown via the same inline form area). Visual only — same handlers `onSlotSelect` / `createBookingMutation.mutateAsync`.

## 2. `BookingConfirmed.tsx`

Replace card-on-grey shell with the new shared header + footer + centered hero, all in `bg-white`/cream:
- Big soft green circle with check mark (centered).
- H1 `You're booked, {firstName}.` (period purple) — reuse existing `interviewerName`/`candidate_name`.
- Muted line `A calendar invite with the video link is on its way to **{candidate_email}**.`
- **Dark detail card** (rounded `2xl`, near-black bg, white text, soft shadow):
  - Left date block: `THU` / big `11` / `Jun` stacked, muted.
  - Right: bold title `{event title} · {stage if any}`, then row with 🕒 time range + EDT and a dot · 🎥 `Google Meet`.
- **White panel below** (same rounded card grouped visually with the dark one — match mockup's "card-on-card" stack):
  - `YOUR PANEL` caps label.
  - Inline chips for each panelist (colored circular initials + name). Use existing booking attendees data already shown in the page; if not available, render only the interviewer.
  - Button row: dark `📅 Add to calendar` (rewires existing `downloadICS`) · outline `🔄 Reschedule` (links to the same booking URL with reschedule param, only if `state` provides it — otherwise hide) · ghost `Cancel` link far right (only if provided — otherwise hide). No new behavior beyond what state already supplies.
- Footer line: `Need to bring something up beforehand? **Reply to your confirmation email**.`
- Reuse the same `PublicBookingFooter`.

Keep the existing fallback "no state" branch but restyled to the same chrome.

Keep the existing confetti effect.

## Out of scope

- No changes to `useBookingAvailability`, `useBookingConfig`, `useBookingEventTypes`, `bookingLinkUtils`, edge functions, routes, or any mutation/query.
- No new fetches; if a field shown in the mockup (city, panelist role, stage X of Y) isn't already loaded, it's simply omitted.
- No design-token changes; only `virgilio-*` semantic tokens and existing Tailwind utilities.

## Files touched

- `src/pages/PublicBookingPage.tsx` (markup/layout only)
- `src/pages/BookingConfirmed.tsx` (markup/layout only)
- `src/components/booking/InterviewerCard.tsx` (restyle, expand props passthrough)
- `src/components/booking/EventTypePicker.tsx` (restyle, render inline-friendly)
- `src/components/booking/MonthCalendar.tsx` (cell styles, header, legend)
- `src/components/booking/TimeSlotsList.tsx` (header row, slot styles, inline Confirm)
- **New:** `src/components/booking/PublicBookingHeader.tsx`
- **New:** `src/components/booking/PublicBookingFooter.tsx`
- **New:** `src/components/booking/JobStageSummaryCard.tsx`
