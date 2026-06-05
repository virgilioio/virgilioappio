## Goal

Match the mockup (`45_Choose_event_type.png`): when the candidate hits a general booking link with multiple event types, show a dedicated, centered "Book time with {Name}." page listing all event types as large cards — instead of the current 3-column layout with the picker squeezed into the left sidebar.

Pure visual / layout change. No logic, no data, no routing changes.

## Current behavior

In `PublicBookingPage.tsx`:
- `showEventPicker = !hasContextualLink && eventTypes.length > 0 && !selectedEventType`
- When true today, page still renders the 3-column main panel and `<EventTypePicker variant="inline">` sits in the left column.

## Changes

### 1. `src/components/booking/EventTypePicker.tsx`
Beef up the `variant="standalone"` branch to render the mockup card style (the current standalone branch is just a basic header — needs the full card list redesign):
- Centered hero: large purple avatar circle with initials, `Book time with {firstName}.` (purple period), subtitle line `{role/title} · {workspace}` when available, paragraph copy, and a meta row (`🌐 {timezone}` · `⭐ Usually replies within a day`).
- `CHOOSE WHAT TO BOOK` section label (10.5px caps, muted).
- Event type cards (vertical stack, max-w-2xl, mx-auto):
  - 56px rounded-xl icon tile, tone-mapped per event type using existing `pickIcon` logic + a small tone map (intro/phone → blue, recruiter/screen → purple, technical/code → green, coffee → orange, default → neutral). Tones use existing `virgilio-*`/Tailwind classes — no new design tokens.
  - Title (Poppins 16/600), optional `• Most booked` lilac chip (use existing `<Badge tone="purple" dot>` if we want a heuristic — otherwise drop; safer to drop since no data flag exists).
  - Description line (13px muted).
  - Meta row: `🕐 {duration} min` · location/format icon + label derived from existing `meeting_location` / icon mapping (Phone call / Google Meet / In person · {location}).
  - Right-side circular arrow button (ghost, hairline border, hover lilac).
- Footer micro-CTA: `❓ Not sure which to pick? Start with an intro call.` — only if an "intro" event type exists; clicking selects it. No new data fetch.

Props additions (all optional): `interviewerFirstName`, `interviewerRole`, `workspaceName`, `timezone`. No behavior changes — still calls `onSelect`.

### 2. `src/pages/PublicBookingPage.tsx`
Add an early-return branch when `showEventPicker` is true (before the 3-column main panel):
- Keep `PublicBookingHeader` + `PublicBookingFooter` chrome.
- Render `<EventTypePicker variant="standalone" ...>` centered in a `max-w-3xl mx-auto px-4 py-10 md:py-16` container.
- Skip the centered intro block, reschedule banner (not relevant here), and main 3-column panel for this state only.
- Pass through `config.profiles` first name, `config.display_name`/role, workspace name, and timezone string already available in component.

Once user clicks a card, `setSelectedEventType` runs as today → existing 3-column scheduling UI renders unchanged.

### 3. Mobile
Same standalone layout works on mobile (single column, generous padding). No separate mobile branch needed for this state.

## Out of scope
- No changes to `useBookingEventTypes`, edge functions, routes, or data shape.
- No "Most booked" tagging (no underlying field) unless we later add a flag.
- No changes to the contextual/job-stage booking flow (still goes straight to scheduler).
- No new design tokens.

## Files touched
- `src/components/booking/EventTypePicker.tsx` (rework standalone variant)
- `src/pages/PublicBookingPage.tsx` (early-return branch for `showEventPicker`)
