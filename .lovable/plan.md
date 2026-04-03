

# Enable Free-Placement: Drop Widgets Into Empty Grid Cells

## The Problem

You're absolutely right. Currently, the only way to move a widget is to **swap it with another widget** (drop ON a card). There's no mechanism to drop a widget into empty grid space — like moving the World Clock from column 0 to column 3 on the same row when columns 3-5 are empty.

The DnD system uses `closestCorners` collision detection, which only targets other sortable items. Empty cells are invisible to it.

## The Fix

Add **invisible droppable cells** to the grid that represent empty space. When you drag a widget over an empty cell, it highlights as a drop target. On drop, the widget moves to that cell's `col`/`row` — no other widget moves at all.

### How it works

```text
Before drag:
[Tasks 2col] [Agenda 2col] [Clock 1col] [ ][ ]
                                          ^  ^
                                      empty cells (cols 5,6 — not droppable today)

After fix:
[Tasks 2col] [Agenda 2col] [Clock 1col] [⬜][⬜]
                                          ^   ^
                                    droppable empty cells with ghost preview
```

When you drag Clock over column 4, the ghost appears there. Drop it — Clock moves to col 4. Tasks and Agenda don't move.

### Implementation

**1. `src/pages/Dashboard.tsx`** — Generate empty cell droppables

During customize mode, compute which grid cells are unoccupied by visible widgets. Render invisible `useDroppable` zones for each empty cell cluster. These participate in DnD collision detection alongside the widget sortables.

On `handleDragEnd`:
- If dropped on a **widget** → swap positions (existing behavior)
- If dropped on an **empty cell** → set widget's `col`/`row` to that cell. No swap needed. Nothing else moves.

**2. `src/hooks/useDashboardLayout.ts`** — Add `moveWidgetTo` function

A new helper that directly sets a widget's `col`/`row` without touching any other widget:

```typescript
const moveWidgetTo = useCallback((widgetId: string, col: number, row: number) => {
  setWidgets(prev => {
    const next = prev.map(w => w.id === widgetId ? { ...w, col, row } : w)
    setHiddenCards(h => { persist(next, h); return h })
    return next
  })
}, [persist])
```

**3. `src/components/dashboard/MasonryGrid.tsx`** — Expose grid geometry

Add a callback or ref that exposes the container rect and column width calculations, so Dashboard.tsx can map pointer coordinates to grid cells during drag. Alternatively, compute empty cells from the items array and totalCols.

**4. `src/components/dashboard/EmptyGridCell.tsx`** — New component

A small droppable zone using `@dnd-kit/core`'s `useDroppable`. Renders as invisible normally, shows a dashed-border ghost when a widget is dragged over it. Each cell knows its `col`/`row` identity.

### What changes for the user

- Drag a 1-col widget to an empty column → it lands there, nothing else moves
- Drag a 2-col widget to an empty 2-col gap → same
- If a widget doesn't fit in the empty space (too wide), the cell doesn't highlight
- Swapping with existing widgets still works as before

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardLayout.ts` | Add `moveWidgetTo(id, col, row)` — direct position set, no swap |
| `src/components/dashboard/EmptyGridCell.tsx` | New: droppable empty cell with ghost preview |
| `src/components/dashboard/MasonryGrid.tsx` | Render empty cell droppables in unoccupied grid positions during customize mode |
| `src/pages/Dashboard.tsx` | Handle drops on empty cells vs. widgets, compute occupied grid map |

