

# AI Notes Analysis — Banner Shape with AI Gradient Border

## Current State
The element is `rounded-full` (pill-shaped), styled like a button. The user correctly points out this is a **notification/banner**, not a button — so it should be rectangular with standard rounded corners (`rounded-lg`).

## Plan

### `src/components/candidates/ExpandableScoreDisplay.tsx` (lines 63-73)

Change the shape from pill to banner while keeping the cursor-following gradient border and clickable behavior:

- **Outer wrapper**: `rounded-full` → `rounded-lg` (rectangular banner shape)
- **Inner element**: `rounded-full` → `rounded-[10px]`, keep `bg-card`, keep click handler
- Keep the `onMouseMove`/`onMouseLeave` cursor-tracking gradient effect — that's the "AI-ish" border
- Optionally add a subtle right-arrow or chevron to hint it's tappable, since it no longer looks like a button

This gives it the look of an alert/banner (like `BackgroundEnrichmentBanner` or `RejectionStatusBanner`) but with the distinctive multicolor gradient border that signals "AI."

