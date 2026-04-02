

# Refactor Dashboard DnD: Multi-Column Architecture

## Problem

The current flat-array + CSS Grid auto-placement model is fundamentally broken for 2D drag-and-drop. Users want to move cards within and between columns, but `@dnd-kit/sortable` only understands a 1D list, causing unpredictable jumps.

## New Architecture

Replace the flat `DashboardCardId[]` with a column-based layout model:

```ts
type ColumnId = 'left' | 'center' | 'right'

interface DashboardColumns {
  left: DashboardCardId[]
  center: DashboardCardId[]
  right: DashboardCardId[]
}

// Default:
{
  left: ['app-review', 'jobs'],
  center: ['tasks', 'onboarding'],
  right: ['agenda']
}
```

Each column gets its own `SortableContext`. Cross-column moves are handled via `onDragOver` (move item between containers) and `onDragEnd` (finalize). This is the same pattern as the Kanban pipeline already in the codebase.

## Changes

### 1. `src/hooks/useDashboardLayout.ts` — Full rewrite

- State shape changes from `DashboardCardId[]` to `DashboardColumns`
- `localStorage` stores the columns object
- New methods:
  - `moveCard(cardId, toColumn, toIndex)` — moves a card to a specific column at a specific index
  - `reorderWithinColumn(columnId, activeId, overId)` — reorder inside one column
- `resetLayout()` resets to default columns
- Validation on load: ensure all known card IDs appear exactly once across all columns, backfill missing ones

### 2. `src/components/dashboard/DraggableDashboardCard.tsx` — Minor update

- Add `columnId` prop so `useSortable` gets a `data` payload with `{ columnId }` — used by `onDragOver` to know the source column
- Everything else (drag handle, overlay, animations) stays identical

### 3. `src/pages/Dashboard.tsx` — Structural rewrite of the grid

**Layout**: Replace the single CSS Grid with 3 explicit flex columns:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
  {(['left', 'center', 'right'] as const).map(colId => (
    <SortableContext key={colId} items={columns[colId]} strategy={verticalListSortingStrategy}>
      <DroppableColumn id={colId}>
        {columns[colId].map(cardId => (
          <DraggableDashboardCard key={cardId} id={cardId} columnId={colId} isCustomizing={isCustomizing}>
            {cardRegistry[cardId]}
          </DraggableDashboardCard>
        ))}
      </DroppableColumn>
    </SortableContext>
  ))}
</div>
```

**DnD logic**:
- `onDragOver`: When dragged item enters a different column's sortable area, move it from source column to target column in state (live preview)
- `onDragEnd`: Finalize position, save to localStorage
- `onDragCancel`: Revert to pre-drag state
- Use `verticalListSortingStrategy` per column (now correct — each column IS a vertical list)

**DroppableColumn**: A simple `div` with `useDroppable` that renders as `flex flex-col gap-6 min-h-[100px]` — provides a drop target even when a column is empty.

**Mobile**: Flatten all columns into a single stacked list (Agenda → Tasks → App Review → etc.), no DnD. Same as today.

**Tablet (md)**: Show 2 columns — merge `left` + `center` into first column, `right` stays as second. Or simply show left and center side by side, right below. DnD still works with the column model.

### 4. New: `src/components/dashboard/DroppableColumn.tsx`

Simple wrapper:
```tsx
function DroppableColumn({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn("flex flex-col gap-6 min-h-[100px] rounded-lg transition-colors", isOver && isCustomizing && "bg-primary/5")}>
      {children}
    </div>
  )
}
```

Provides a subtle highlight when dragging over an empty column.

## Visual result

Identical to current dashboard — 3 equal columns, same gap, same card styles. The only visible difference is that dragging now works correctly: cards move within and between columns without jumping.

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardLayout.ts` | Rewrite: column-based state model with cross-column move support |
| `src/components/dashboard/DraggableDashboardCard.tsx` | Add `columnId` prop, pass as sortable data |
| `src/components/dashboard/DroppableColumn.tsx` | New — droppable flex column wrapper |
| `src/pages/Dashboard.tsx` | Render 3 explicit columns with per-column SortableContext, onDragOver for cross-column moves |

