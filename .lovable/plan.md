# Fix: "+ Add panelist" pill still closes on click

## Root cause

The previous fix stabilized the visual anchor, but the pill is still rendered as a `PopoverAnchor`, not a `PopoverTrigger`. Radix uses the trigger/content relationship for dismissal handling; an anchor is only a positioning reference. Because the clicked pill is not the trigger, Radix can still treat that click/focus as an outside interaction and close the popover immediately.

## Fix

Stabilize the anchor and stop fighting the popover lifecycle.

1. Replace `PopoverAnchor` with `PopoverTrigger asChild` around one stable wrapper so Radix knows the pill/input is the trigger, not an outside element.
2. Move activation to the stable trigger wrapper: clicking the dotted pill sets `editing`, opens the popover, and focuses the input after render.
3. Keep the wrapper mounted while switching between dotted pill and input, so focus/positioning stay stable.
4. Keep outside-click and Escape behavior: outside click closes and returns to dotted pill; Escape closes and clears the query.
5. If Radix trigger toggling conflicts with the controlled open state, explicitly prevent the default trigger toggle and drive `open/editing` from our handler.

No visual or behavioral changes beyond the pill morph working as designed: dotted pill → input + dropdown stays open → type to filter → click to add chip → input clears and stays open for next add → Esc or outside click reverts to dotted pill.

## Files

- `src/components/candidates/ScheduleInterviewSheet.tsx` — only the `PanelistComboField` subcomponent.

## Out of scope

Everything else in the sheet stays as-is.
