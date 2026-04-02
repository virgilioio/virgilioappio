

# Fix Dashboard DnD: Allow Dropping Below Items in Same Column

## Problem

The current setup uses `rectSortingStrategy` which treats all grid items as a flat list. When you drag a card toward another card in the same column, `closestCenter` collision detection causes the target to shift away before you can drop below it — the items swap positions instead of allowing insertion.

## Solution

Switch from `rectSortingStrategy` to `verticalListSortingStrategy` — but that won't work well for a grid. The real fix is two changes:

1. **Replace `closestCenter` with `closestCorners`** — this collision detection algorithm is more forgiving in grid layouts and better handles the "drop below" intent by considering corner proximity rather than center-to-center distance.

2. **Add `animateLayoutChanges` override to `useSortable`** in `DraggableDashboardCard.tsx` — disable the layout animation during active drags so items don't visually shift while you're still holding the dragged card. Items only reorder on drop.

```tsx
// In DraggableDashboardCard.tsx
const animateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args;
  if (isSorting || wasDragging) return false;
  return defaultAnimateLayoutChanges(args);
};

useSortable({ id, disabled: !isCustomizing, animateLayoutChanges })
```

This means while dragging, the other cards stay put visually. When you drop, the reorder happens cleanly without the "jumping" behavior.

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/DraggableDashboardCard.tsx` | Add `animateLayoutChanges` override to suppress layout shifts during active drag |
| `src/pages/Dashboard.tsx` | Switch collision detection from `closestCenter` to `closestCorners` |

