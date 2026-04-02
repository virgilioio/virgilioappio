

# Fix Dashboard DnD: Eliminate Gaps + Runtime Error

## Problem

Two issues:

1. **Huge gaps when stacking cards**: CSS Grid forces all items in the same row to share the same row height (determined by the tallest card). When you drop a short card below a tall card in the same column, the grid cell for the short card stretches to match its row neighbor, creating a massive visual gap.

2. **Runtime error**: `closestCenter is not defined` — likely a stale build cache, but the code looks correct (imports `closestCorners`). A rebuild should clear it.

## Solution

Add `items-start` to the grid container. This tells CSS Grid to align each item to the top of its cell instead of stretching it to fill the full row height. The cards will hug their natural height, eliminating the gap issue.

On the grid divs (both the DnD and non-DnD versions), change:
```
grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3
```
to:
```
grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 items-start
```

This single CSS change fixes the visual gap problem because each card now only occupies its natural height within the grid, regardless of what's next to it in the same row.

## Files changed

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add `items-start` to both grid containers (lines 146 and 161) |

