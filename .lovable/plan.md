# Click-to-move stages in candidate profile stage strip

Make each stage chip in the candidate profile's stage bar clickable. Clicking a stage moves the candidate to that stage immediately — no dropdown, no confirmation button.

## Behavior

- Click any stage chip → move candidate to that stage.
- Current stage chip: not clickable (no-op).
- While the move is in flight, disable interaction on the strip and show a subtle pending state on the clicked chip.
- Past/future chips both work (allows moving forward or back).
- If the candidate has no association yet, or is rejected/hired, the strip stays read-only.
- Success/error toasts are handled by the existing `moveAssociationToStage` hook.

## Technical scope

1. **`ProfileStageStrip.tsx`**
   - Add optional `onStageClick?: (jhsId: string) => void | Promise<void>` and `disabled?: boolean` props.
   - Wrap each chip in a `<button>` when `onStageClick` is set and the chip is not the current stage; keep a plain `<div>` for current/disabled.
   - Add hover affordance (subtle ring/bg shift) for clickable chips, cursor pointer.
   - Track an internal `pendingId` so the clicked chip shows a muted/loading state while awaiting the promise.

2. **`CandidateProfileSheet.tsx` (~line 1161)**
   - Pass `onStageClick` to `<ProfileStageStrip>`:
     - Guard on `associationId`, `associationStatus === 'active'`, and target ≠ current.
     - Call `moveAssociationToStage(associationId, jhsId)`, then `setCurrentStageId(jhsId)` and `onStageChanged?.()` — same pattern as the existing "Advance" handler.
   - Pass `disabled` when no `associationId` or status is rejected/hired.

No backend, hook, or schema changes. Pure UI + wiring to the existing `usePipelineActions` hook.
