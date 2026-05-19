# Fix: "+ Add panelist" pill closes immediately on click

## Root cause

In `PanelistComboField` the `<PopoverAnchor asChild>` wraps a conditional that swaps the resting `<button>` for the active `<input>` on click. The anchor child unmounts and a new node mounts in the same tick, which makes Radix Popover see a focus/pointer change outside its tree and trigger `onOpenChange(false)` — the menu closes before the input is usable. The `onBlur` auto-close on the input compounds the problem: as React re-renders, the input briefly loses focus and `deactivate()` fires.

## Fix

Stabilize the anchor and stop fighting the popover lifecycle.

1. Keep a single, always-mounted anchor element (a `<div>`) that contains either the button or the input. The Popover anchor never unmounts during the morph, so Radix keeps the open state.
2. Remove the `onBlur` auto-close handler. Rely on Popover's own outside-click + Escape handling for closing. Escape inside the input also calls `deactivate()` explicitly.
3. On `onOpenChange(false)` from Radix, run `deactivate()` so the pill returns to its dotted resting state when the user clicks outside.
4. Call `activate()` on `pointerDown` (not `click`) for the resting pill so the focus + open happens before Radix's outside-click detector evaluates pointer-up.
5. Add `onPointerDownOutside` passthrough on `PopoverContent` left at default — no custom handling.

No visual or behavioral changes beyond the pill morph working as designed: dotted pill → input + dropdown stays open → type to filter → Enter/click to add chip → input clears, stays open for next add → Esc or outside click reverts to dotted pill.

## Files

- `src/components/candidates/ScheduleInterviewSheet.tsx` — only the `PanelistComboField` subcomponent.

## Out of scope

Everything else in the sheet stays as-is.
