

# User-Controlled Card Column Spanning

## The challenge

The current architecture uses 3 independent flex columns. A card that spans 2 columns cannot live inside a single flex column — it needs to break across column boundaries. This is a fundamental layout change.

### Why it's hard

The multi-column DnD model stores cards as members of one column. A 2-col-wide card conceptually "owns" two column slots. The rendering and drag logic both need to understand this.

### Recommended approach: CSS Grid subgrid with span metadata

Instead of 3 separate flex columns rendered independently, switch the inner rendering to a single CSS Grid with `grid-template-columns: repeat(3, 1fr)` and explicit `grid-column` / `grid-row` placement. Each card gets a `colSpan: 1 | 2` property. The column ownership model stays the same (left/center/right), but rendering computes explicit grid positions from the column arrays + span info.

**Key insight**: The data model (3 column arrays) stays intact for DnD. Only the rendering layer changes to support spanning. A 2-col card anchored in "left" visually extends into "center."

## Changes

### 1. `src/hooks/useDashboardLayout.ts`

- Add `cardSpans: Record<DashboardCardId, 1 | 2>` to state (default all `1`)
- Persist in localStorage alongside columns/hidden
- New method: `toggleCardSpan(cardId)` — toggles between 1 and 2
- Constraint: a card in the "right" column toggled to span 2 would visually overflow. When a card is set to span 2, if it's in column "right", move it to "center" (spans center+right). If in "center", it spans center+right. If in "left", it spans left+center.
- When dragging a 2-col card, it always lands as span-1 temporarily (simplifies placement), user re-expands after dropping

### 2. `src/pages/Dashboard.tsx`

- Replace the 3 independent flex column divs with a single CSS Grid container using explicit `grid-column` and `grid-row` placement
- Compute grid positions from the column arrays: left cards start at col 1, center at col 2, right at col 3; span-2 cards get `grid-column: span 2`
- Row positions computed by walking each column's card list and tracking row offsets
- DnD contexts remain per-column (SortableContext per column still works — the card's "home" column is its anchor)
- In customize mode, each card shows a small "expand/collapse" icon button (e.g., `Maximize2`/`Minimize2`) to toggle between 1-col and 2-col

### 3. `src/components/dashboard/DraggableDashboardCard.tsx`

- Add optional `onToggleSpan` prop and `colSpan` prop
- When `isCustomizing`, show a resize toggle button (opposite side from the X button, or next to drag handle)
- Visual indicator: when span is 2, the card ring/border could be slightly different shade

### 4. DnD behavior with spanning

- During drag (`onDragStart`), temporarily collapse the card to span-1 for clean placement
- On drop (`onDragEnd`), restore the original span
- Cross-column moves: if a span-2 card is dropped in "right", auto-move it to "center" so it can span center+right
- Mobile/tablet: spanning is ignored (single column / 2-col layout), cards always render as span-1

## Complexity assessment

This is a **significant** change. The rendering layer shifts from "3 independent flex columns" to "1 CSS Grid with computed placement." DnD logic gets more complex with span-aware constraints. Estimated ~200-300 lines of new/changed code across 3 files.

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardLayout.ts` | Add `cardSpans` state, `toggleCardSpan` method, span-aware column constraints |
| `src/components/dashboard/DraggableDashboardCard.tsx` | Add `onToggleSpan` + `colSpan` props, resize toggle button |
| `src/pages/Dashboard.tsx` | Replace flex columns with CSS Grid explicit placement, span-aware rendering, span toggle during DnD |

