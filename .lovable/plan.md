
# Fix dashboard DnD so cards stop “running away”

## Root cause in the current code

The instability is coming from the interaction model, not the visual polish:

- `Dashboard.tsx` calls `reorderWidgets()` inside `onDragOver`
- `useDashboardLayout.ts` currently **swaps order values immediately**
- `computePlacements()` then **re-packs the whole dashboard from scratch**
- because widgets have different spans, one hover can reshuffle many later placements

So the dragged card is not being “placed below this card” in a stable way. It is repeatedly triggering a full layout recomputation while hovering.

## Plan

### 1. Stop mutating layout during hover
In `src/pages/Dashboard.tsx`:

- remove structural reordering from `handleDragOver`
- keep `onDragOver` only for **preview state**
- only commit the layout change in `onDragEnd`

This prevents the whole dashboard from rearranging while the user is still aiming.

### 2. Switch from “swap with hovered card” to “insert above/below target”
Instead of treating a hovered card as a swap target, treat it as an insertion target:

- detect whether the pointer is in the **top half** or **bottom half** of the target card
- interpret that as:
  - `before target`
  - `after target`

This matches the user’s mental model:
- top half = place above
- bottom half = place below

### 3. Add explicit insertion helpers in the layout hook
In `src/hooks/useDashboardLayout.ts` add focused helpers such as:

- `moveWidgetBefore(activeId, targetId)`
- `moveWidgetAfter(activeId, targetId)`

These should:
- remove the active widget from its current position
- insert it before/after the target
- re-normalize `order`
- keep persistence behavior unchanged

This is more precise than the current swap-based logic.

### 4. Add restrained drop-zone visualization
In `src/components/dashboard/DraggableDashboardCard.tsx`:

- replace the generic whole-card hover ring with **top/bottom insertion indicators**
- show a subtle line / band only where the card will land
- keep styling serious and minimal

This makes the drop result obvious without causing the layout to jump.

### 5. Preserve overlay and current premium motion
Keep the existing:

- `DragOverlay`
- calm easing
- masonry transitions
- customize-mode controls

Only the placement logic changes.

## File changes

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Remove live reorder on hover, compute top/bottom insertion intent, commit move on drag end |
| `src/hooks/useDashboardLayout.ts` | Replace swap-only reorder with insertion helpers and normalized ordering |
| `src/components/dashboard/DraggableDashboardCard.tsx` | Add explicit top/bottom drop indicators instead of a generic over-state |
| `src/components/dashboard/MasonryGrid.tsx` | Likely no major logic change; only minor support if needed for target measurement |

## Expected result

After this change:

- dragging over a card will **not** make the whole dashboard reshuffle
- users can place a card **above or below** another card intentionally
- the hovered card stays put while aiming
- the drop target is visually clear
- customization keeps the current polished, premium feel without chaotic movement

## Technical note

The key fix is: **preview intent during drag, mutate layout only on drop**.

That restores spatial stability while keeping the current 6-column masonry foundation intact, instead of replacing the whole layout system again.
