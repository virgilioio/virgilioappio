## Problem
The Configure widget popover is rendered with `absolute` positioning inside the widget card. In the recent responsiveness fix we added `overflow-hidden` to the outer card (`WidgetFrame.tsx`, line 50), which now clips the popover so users can't fully see or interact with it.

The inner body already has its own `overflow-hidden` to clip charts, so the outer clip is redundant for the original goal.

## Fix
**File:** `src/components/analytics/widgets/WidgetFrame.tsx`

- Line 50: remove `overflow-hidden` from the outer card class list. Keep `min-w-0` so the card still shrinks correctly inside the grid.
- Line 94: keep `overflow-hidden` on the inner body wrapper — this is what actually prevents charts from bleeding.

Net effect:
- Charts remain clipped to the body (no regression on responsiveness fix).
- The Configure popover, which is anchored to the card (not the body), can extend beyond the card edges when needed and stays fully visible.

## Out of scope
- No change to the popover's positioning logic or chart components.
