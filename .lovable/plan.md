# Anchor the calendar event popup to the clicked event

## Problem

On ATS → Calendar (week view), clicking any event opens the detail card in the top-right corner of the grid instead of next to the event. The popup is rendered with a fixed `top: 12, right: 12` offset inside the grid body, so its position ignores which event was clicked.

## Fix

Position the popup relative to the event button that opened it:

- When an event is clicked, capture the clicked button's position (its rect relative to the grid body container) alongside the event id.
- Render the popup at that anchor: horizontally beside the event's day column (to the right of the event, flipping to the left when there isn't room), vertically aligned with the event's top edge.
- Clamp to the grid bounds so the card never overflows the calendar area or the viewport: shift up when near the bottom, flip side when near the right edge, keep a small gap (8px) from the event.
- Clear the anchor when the popup closes, when the week changes, or when filters change the selected event away.

No changes to event data, filters, navigation actions (open candidate / join), or the popup's contents — only where it appears.

## Technical notes

- File: `src/pages/Calendar.tsx`.
  - `renderEvent` (line ~223): pass the click event's `currentTarget` rect into state along with `setSelectedEventId`.
  - Add a `ref` on the grid body wrapper (the `position: relative` grid at line ~503) to convert the button rect into container-relative coordinates.
  - `EventPopover` (line ~636): replace the hardcoded `top: 12, right: 12` with computed `top`/`left` props, keeping the existing `absolute z-50` card styling, backdrop click-to-close, and width 280.
  - Flip/clamp math done from the container rect plus the popup's measured height (measure via ref after mount, with a sensible fallback).
