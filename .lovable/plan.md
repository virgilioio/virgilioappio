# Two scheduling fixes

## 1. Dragging the time block jumps to the end of the day

In the Schedule interview sheet, grabbing the purple selection block and dragging it snaps it to the latest possible time instead of following the cursor.

Cause (confirmed by reading `src/components/candidates/AvailabilityStrip.tsx`): the `Row` lane component is declared *inside* `AvailabilityStrip`, so every re-render creates a new component type and React remounts all lanes. The drag handler captured the DOM track element at pointer-down; after the first state update that element is detached, its width measures 0, the cursor→minutes math divides by zero, clamps to 100%, and the block lands at the last bookable start time.

Fix:
- Move `Row` out of the component body (top-level, stable identity) so lanes stop remounting mid-gesture.
- Make the drag math resolve the track from the ref at each pointer-move instead of holding a captured element, and read the current start/duration from refs, so no stale values leak into move or resize.
- Guard the cursor→minutes conversion against a zero-width rect.

Behavior stays exactly as designed: 15-minute snapping, clamped to 9:00–18:00, click-to-place, drag-to-move, right-edge resize, holds still bookable.

## 2. Hero "Schedule" button uses the old sheet

On the in-job candidate profile, the hero card's **Schedule** button opens `SimpleScheduleInterviewSheet` (the old form), while the Current stage card opens the new `ScheduleInterviewSheet`.

Fix: point the hero button at the same handler the Current stage card uses — open the new sheet pre-filled with the candidate's current stage, job, and association. If the candidate has no current stage or association yet (edge case), the button falls back to the existing simple sheet so nothing breaks.

`SimpleScheduleInterviewSheet` stays in place for the other surfaces that legitimately use it (Calendar, Application review, independent candidate profile).

## Technical notes

- Files: `src/components/candidates/AvailabilityStrip.tsx`, `src/components/candidates/CandidateProfileSheet.tsx`.
- No data model, mutation, permission, or edge-function changes.
