

# Fix Dashboard DnD: Drop Target Visualization + Bidirectional Placement

## Problems

### 1. Can't place widgets above others
The `swapPlacements` function swaps `gridRow`/`gridColumn` values in cached placements, but `MasonryGrid` completely ignores those values. It re-derives positions from the `items` array order and `colStart`/`colSpan`. So the swap has no real effect on visual ordering — items always pack in their original array order.

**Fix**: Instead of swapping cached placement coordinates, swap the actual widget order values and let MasonryGrid repack from the new order. The order swap already happens via `reorderWidgets`, but `cachedPlacements` overrides it. Remove the `swapPlacements` abstraction and rebuild `cachedPlacements` from the reordered widgets immediately after a swap.

### 2. No drop zone visualization
There is zero visual feedback when dragging over a target widget. The `DraggableDashboardCard` uses `useSortable` which exposes `isOver`, but it's never used. The user gets no indication of where the widget will land.

**Fix**: Use `isOver` from `useSortable` to show a subtle highlight ring on the target card during hover. Keep it restrained — a soft border glow, not a full drop zone expansion.

### 3. Real-time reorder during drag (onDragOver)
Currently reordering only happens on `onDragEnd`. Adding `onDragOver` enables live preview of the swap as the user drags, giving immediate spatial feedback.

## Implementation

### `src/components/dashboard/DraggableDashboardCard.tsx`
- Destructure `isOver` from `useSortable`
- When `isOver && isCustomizing`, add a subtle ring highlight (`ring-2 ring-primary/30`) to the card wrapper
- This gives immediate visual feedback for the drop target

### `src/pages/Dashboard.tsx`
- Remove `swapPlacements` utility entirely
- Remove `cachedPlacements` and `lastStructuralKey` state — they add complexity and desync from actual widget order
- Compute placements directly from `renderableWidgets` on every render (the masonry computation is cheap)
- Add `onDragOver` handler: when active widget hovers over a different widget, call `reorderWidgets` to swap their order values live — MasonryGrid will repack and show the preview immediately
- On `onDragEnd`: call `finalizeLayout()` to persist
- On `onDragCancel`: call `cancelDrag()` to restore pre-drag order

### `src/components/dashboard/MasonryGrid.tsx`
- No changes needed — it already handles position transitions smoothly

## Result
- Dragging over a card highlights it subtly
- The layout previews the swap in real-time during drag
- Dropping finalizes the position
- Widgets can be placed above or below others because the order array is the source of truth
- No cached placement desync issues

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/DraggableDashboardCard.tsx` | Add `isOver` highlight ring for drop target visualization |
| `src/pages/Dashboard.tsx` | Remove `swapPlacements`/caching, add `onDragOver` for live reorder preview, compute placements directly |

