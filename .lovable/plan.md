

# Fix Snap Scrolling in Job Detail Pipeline

## Problem
In `JobDetail.tsx`, `PipelineOverview` is rendered with `externalScroll={true}`. This means the snap classes (`snap-x snap-mandatory`) are skipped (line 576: `externalScroll ? '' : 'overflow-x-auto snap-x ...'`). The scroll is handled by a parent `ScrollArea` with `w-fit`, which doesn't support CSS snap.

Additionally, the parent `div` has `w-fit` in board mode, making the container as wide as all columns — so there's no overflow on the flex container itself, and snap has nowhere to apply.

## Fix

**`src/pages/JobDetail.tsx`** (lines ~1097 and ~1472, both desktop and mobile renders):
- In board view, change the wrapper from `w-fit` to `w-full` so the container constrains width
- Remove `externalScroll` prop (or set to `false`) so `PipelineOverview` manages its own horizontal scroll with snap
- Remove or adjust the `ScrollArea` wrapper for board view — native `overflow-x-auto` with snap is needed instead

**`src/components/jobs/PipelineOverview.tsx`**:
- No changes needed — snap classes are already correct, they just need `externalScroll={false}` to activate

## Result
On mobile (390px viewport), each stage card renders at `85vw` (~331px) with `snap-center`, snapping into place when swiping horizontally.

