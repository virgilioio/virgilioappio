

# Fix: Widget Disappearance, World Clock, and Empty-Cell Placement

## Root Causes Found

### Bug 1: Everything disappears on resize
`cycleWidgetSize` changes a widget's size without clamping its column. If "Jobs Overview" sits at col=3 and cycles from medium (3 cols) to large (4 cols), it spans cols 3-6. But colBottoms only has indices 0-5 (6-col grid). `colBottoms[6]` is `undefined` → `Math.max(undefined)` = `NaN` → **every subsequent widget gets NaN position** → all invisible. One overflow corrupts the entire masonry engine.

### Bug 2: World Clock missing
Same mechanism — if a prior resize corrupted the layout, or if the clock was moved to an empty cell with row=999 (the sentinel value from EmptyGridCell), it sorts to the very end. If colBottoms are already NaN from a prior overflow, the clock renders at NaN top → invisible.

### Bug 3: Can't place in empty column spaces
The `emptyCells` algorithm only creates droppable zones at column bottoms (where one column is shorter than the tallest) and at the very bottom row. It never creates drop zones **beside** existing widgets in the same visual band. So if the world clock is at col=4 and col=5 is empty at the same height, there's no droppable there.

## Plan

### 1. `src/hooks/useDashboardLayout.ts` — Clamp col on resize

In `cycleWidgetSize`, after computing `newSize`, clamp `col` so `col + SIZE_TO_COLS[newSize] <= TOTAL_COLS`:

```typescript
const newSpan = SIZE_TO_COLS[newSize]
const maxCol = TOTAL_COLS - newSpan
const safeCol = Math.min(w.col, maxCol)
return { ...w, size: newSize, col: safeCol }
```

Same guard in `setWidgetSize`.

### 2. `src/components/dashboard/MasonryGrid.tsx` — Safety clamp at render + better empty cells

**Clamp items at render time** (defensive, handles any bad stored data):
```typescript
const safeColStart = Math.min(item.colStart, totalCols - item.colSpan)
const safeColSpan = Math.min(item.colSpan, totalCols - safeColStart)
```

**Better empty cell computation**: Instead of only column-bottom gaps, scan each occupied visual band (grouped by `top` values) and find which columns are free at that height. This creates droppable zones beside existing widgets, not just below them.

Algorithm:
- Collect all unique `top` values from positioned items
- For each top value, mark which columns are occupied (by items whose top matches and whose colStart..colStart+colSpan covers those cols)
- For each unoccupied column at that top value, emit an empty cell droppable
- Also keep the existing bottom-of-column cells for appending below

### 3. `src/components/dashboard/EmptyGridCell.tsx` — Use meaningful row values

Pass the actual visual band index (derived from top position) instead of sentinel values 999/1000, so `moveWidgetTo` stores a sensible row that sorts correctly.

### 4. `src/pages/Dashboard.tsx` — No changes needed

The `handleDragEnd` logic for empty cells and swaps is correct. The fixes are upstream.

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardLayout.ts` | Clamp col on resize to prevent overflow; clamp in `moveWidgetTo` too |
| `src/components/dashboard/MasonryGrid.tsx` | Safety-clamp colStart/colSpan; compute same-band empty cells beside widgets |
| `src/components/dashboard/EmptyGridCell.tsx` | No structural change, just receives better row values from MasonryGrid |

