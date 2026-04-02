

# Polish Dashboard DnD: Stable Placement via Swap Instead of Reorder

## Root Cause

`reorderWidgets` uses splice-based array reordering: it removes the dragged widget and inserts it at the target's position, shifting everything in between. Then `computePlacements` repacks all widgets from scratch into a 6-column grid. This causes widgets that weren't involved in the drag to shift positions — breaking the user's mental model.

## Solution: Swap, Don't Splice

When a user drags widget A onto widget B, **swap their order values** instead of splicing. This means only A and B change positions; every other widget stays exactly where it was.

### Changes

### 1. `src/hooks/useDashboardLayout.ts` — Swap-based reorder

Replace the splice-based `reorderWidgets` with a simple order-value swap:

```
const reorderWidgets = (activeId, overId) => {
  setWidgets(prev => {
    const activeWidget = prev.find(w => w.id === activeId)
    const overWidget = prev.find(w => w.id === overId)
    if (!activeWidget || !overWidget) return prev
    const activeOrder = activeWidget.order
    const overOrder = overWidget.order
    return prev.map(w => {
      if (w.id === activeId) return { ...w, order: overOrder }
      if (w.id === overId) return { ...w, order: activeOrder }
      return w
    }).sort((a, b) => a.order - b.order)
  })
}
```

This ensures only the two involved widgets change grid position. All neighbors stay put.

### 2. `src/pages/Dashboard.tsx` — Collision detection + visual polish

- Switch from `closestCenter` to `closestCorners` for better spatial accuracy in a grid with variable-width items
- Add `TouchSensor` with 180ms delay for mobile/tablet ergonomics
- Ensure the DragOverlay uses consistent width by passing the active widget's `colSpan` to size the overlay container
- Add `transition: 'transform 200ms ease'` to non-dragging grid items for smoother reflow when a swap occurs

### 3. `src/components/dashboard/DraggableDashboardCard.tsx` — Minor polish

- Re-enable `defaultAnimateLayoutChanges` for non-drag/non-sort scenarios (current implementation already does this correctly)
- Add a subtle `scale(0.98)` on the source position while dragging to create a placeholder feel rather than full `opacity: 0`

### 4. Visual spacing polish in `src/pages/Dashboard.tsx`

- Change grid gap from `gap-6` to `gap-5` for tighter card rhythm
- Ensure `items-start` is present (already is) to prevent row-height stretching

## Why this works

The packing algorithm is deterministic: same order + same sizes = same positions. By only swapping two order values, the packer produces a layout that differs from the previous one in exactly two positions. No cascading reflows, no surprising jumps.

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardLayout.ts` | Replace splice reorder with order-value swap |
| `src/pages/Dashboard.tsx` | Switch to `closestCorners`, add TouchSensor, tighten gap |
| `src/components/dashboard/DraggableDashboardCard.tsx` | Subtle drag placeholder styling |

