

# Customizable Dashboard: Drag-to-Reorder Cards

## Two parts to address

### Part 1: Fix tablet layout (quick fix)

The current grid uses `order-first md:order-last` which causes the Agenda card to jump to the end on tablet, breaking the visual flow. The fix is to ensure on tablet (md, 2-col), the order is: Tasks + App Review in the first two slots, Agenda wraps below at full width or stays in its slot naturally.

### Part 2: Draggable/customizable dashboard cards

**Not crazy at all.** You already have `@dnd-kit/core` + `@dnd-kit/sortable` installed and used extensively (pipeline, stage config, form builders). The pattern is well-established in the codebase.

**How it works:**

1. **New hook: `useDashboardLayout.ts`**
   - Stores card order as an array of card IDs in `localStorage` (e.g. `['agenda', 'tasks', 'app-review', 'onboarding', 'jobs']`)
   - Falls back to a default order
   - Exposes `cardOrder`, `reorderCards(from, to)`, and `resetLayout()`
   - Uses `arrayMove` from `@dnd-kit/sortable` for reordering

2. **New wrapper: `DraggableDashboardCard.tsx`**
   - Uses `useSortable` from `@dnd-kit/sortable` (same pattern as `DraggableStageItem`, `PostingFieldsBuilder`)
   - Wraps each dashboard card with a drag handle (grip icon, visible on hover)
   - Follows the existing DnD style rules: `CSS.Translate`, opacity transitions, `DragOverlay` with rotate/scale

3. **Update `Dashboard.tsx`**
   - Wrap the grid in `DndContext` + `SortableContext`
   - Render cards dynamically from the stored order array
   - Add a subtle "Customize" toggle button (e.g. near the welcome header) that enables drag handles
   - When not in customize mode, cards render normally with no drag affordance

4. **Responsive behavior**
   - On mobile: disable drag entirely (touch scrolling conflicts) — keep the fixed mobile order (Agenda → Tasks → App Review)
   - On tablet/desktop: drag-to-reorder works, saved order persists

**Data flow:**
```text
localStorage["dashboard-layout"]
  → useDashboardLayout() hook
    → Dashboard.tsx reads cardOrder[]
      → SortableContext renders cards in that order
        → DragOverlay shows card preview while dragging
          → onDragEnd → arrayMove → save to localStorage
```

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardLayout.ts` | New — localStorage-backed card order state with arrayMove |
| `src/components/dashboard/DraggableDashboardCard.tsx` | New — useSortable wrapper with drag handle |
| `src/pages/Dashboard.tsx` | Fix tablet ordering; wrap grid in DndContext/SortableContext; render cards from dynamic order; add customize toggle |

