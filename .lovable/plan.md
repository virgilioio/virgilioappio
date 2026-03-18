

# Mobile UX Improvements — 4 Issues

## 1. Pipeline Page Horizontal Overflow on JobRow Cards

**Problem**: The metrics strip inside `JobRow.tsx` (lines 87-106) renders stage conversions and overall conversion in a single `flex` row with no wrapping or overflow control. On mobile, this causes horizontal page scroll.

**Fix** in `src/components/pipeline/JobRow.tsx`:
- Make the metrics strip (`flex items-center gap-6`) wrap on mobile: add `flex-wrap` and reduce gap
- Make the inline stage summary in the accordion trigger (lines 70-79) also wrap or become horizontally scrollable with `overflow-x-auto` instead of bleeding out
- Hide the "Open in new tab" button on mobile (it's already opacity-0 by default but takes space)

## 2. Snap Scrolling on Pipeline Board View (Mobile)

**Problem**: The Kanban board columns in `PipelineOverview.tsx` (line 572) scroll freely with `overflow-x-auto`. On touch devices, stages don't snap into view — you land between columns.

**Fix** in `src/components/jobs/PipelineOverview.tsx`:
- Add CSS snap scrolling to the board container: `snap-x snap-mandatory` on the scrollable `div` (line 572)
- Add `snap-center` (or `snap-start`) to each stage `Card` (line 584)
- Make stage cards `w-[85vw]` on mobile instead of the fixed `w-72` so each card fills most of the screen, ensuring one-at-a-time viewing. Keep `w-72` on `sm:` and up.
- Same treatment for the embedded pipeline inside `JobRow.tsx` (line 109)

## 3. Application Review Candidates Not Visible in Pipeline Overview

**Problem**: `PipelineOverview.tsx` line 219 explicitly filters out `application_review` stages. This is correct for the Job Detail view (which has a dedicated Application Review tab), but when PipelineOverview is embedded in the Pipeline page via `JobRow`, there is no separate Application Review tab — those candidates simply vanish.

**Fix**:
- Add a prop to `PipelineOverview`: `includeApplicationReview?: boolean` (default `false` to preserve existing Job Detail behavior)
- In `JobRow.tsx`, pass `includeApplicationReview={true}` so the Application Review stage column appears in the Pipeline page's embedded Kanban
- In `PipelineOverview.loadStages`, conditionally skip the `application_review` filter when the prop is true

## 4. Mobile Navigation — Replace Side Sheet with Dropdown/Popover

**Problem**: The hamburger menu opens a `Sheet` sliding from the left (`side="left"`, `w-264`). For a simple vertical nav list, a dropdown-style popover anchored to the hamburger icon feels more native and lightweight.

**Fix** in `src/components/layout/Header.tsx`:
- Replace the `Sheet`/`SheetContent` wrapper (lines 333-348) with a `DropdownMenu` (or `Popover`) anchored to the hamburger `Button`
- Render `NavigationContent()` inside the dropdown body with vertical stacking (it already is vertical)
- This removes the overlay, the slide animation, and the close-X — tap outside dismisses it naturally
- Keep the same `NavigationContent` component, just change the container

## Files to Edit

| File | Changes |
|---|---|
| `src/components/pipeline/JobRow.tsx` | Wrap metrics strip; pass `includeApplicationReview` to PipelineOverview |
| `src/components/jobs/PipelineOverview.tsx` | Add `includeApplicationReview` prop; add snap scroll classes; responsive card width |
| `src/components/layout/Header.tsx` | Replace Sheet with DropdownMenu/Popover for mobile nav |

