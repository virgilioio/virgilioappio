

# Fix Dashboard Layout: Eliminate Vertical Gaps + Stable DnD

## Root Cause

**The vertical gaps and cascading movement are two symptoms of the same architectural problem: CSS Grid's row model.**

CSS Grid forces all items in the same row to share the same row height. When row 1 has a tall 4-col "Jobs Overview" widget and a short 2-col "Tasks" widget, the next row starts *below the tall widget* — creating a massive visual gap beneath "Tasks" even though nothing is below it. `items-start` only aligns items to the top of their row cell; it doesn't collapse the row height.

This is not a bug in our code — **CSS Grid fundamentally cannot do masonry/tight-packing layout**. No amount of tweaking `gridRow`, `items-start`, or swap logic will fix this.

## Solution: Switch to Absolute Positioning with Height-Aware Packing

Replace CSS Grid with a container that uses `position: relative` and positions each widget with `position: absolute`, computing `top` and `left` values based on **measured widget heights**.

### How it works

1. **Measure phase**: Each widget renders normally inside a wrapper. A `ResizeObserver` reports each widget's actual pixel height.
2. **Pack phase**: A column-height-tracking algorithm places widgets into the grid:
   - Maintain an array of `columnBottoms[6]` tracking the current bottom edge (in px) of each column
   - For each widget (in order), find the position where it fits (enough contiguous columns available) with the **lowest top edge** (i.e., `Math.max(...columnBottoms[col..col+span])`)
   - Place the widget at that `top` value, at the correct `left` (column index × column width)
   - Update `columnBottoms` for the occupied columns
3. **Container height**: Set to `Math.max(...columnBottoms)` so the parent sizes correctly

This gives true masonry-style packing: a short widget in column 5 won't leave a gap just because column 1-4 has a tall widget.

### DnD stability

The swap model stays: dragging widget A onto widget B swaps their `order` values only. The packing algorithm re-runs, but because only two order values changed, the result differs in exactly those two positions. Other widgets stay put because their order didn't change and the height-aware packer places them in the same columns.

### New component: `MasonryGrid`

A dedicated component that:
- Renders children in a `position: relative` container
- Wraps each child in a measured `position: absolute` div
- Uses `ResizeObserver` to track heights
- Runs the packing algorithm on height changes
- Animates position changes with CSS transitions (`transform` + `transition: 200ms ease`)

### Changes

| File | Change |
|------|--------|
| `src/components/dashboard/MasonryGrid.tsx` | **New** — height-aware absolute-positioning layout engine with ResizeObserver |
| `src/hooks/useDashboardLayout.ts` | Update `computePlacements` to return column index + span (no `gridRow`), add a pixel-based placement type |
| `src/pages/Dashboard.tsx` | Replace CSS Grid `div` with `MasonryGrid` component, keep all existing DnD/customize logic |
| `src/components/dashboard/DraggableDashboardCard.tsx` | Remove `CSS.Translate` transform (MasonryGrid handles positioning) |

### What stays the same

- Widget registry, sizes, persistence, hide/show, resize cycling
- DnD sensors, collision detection, swap logic
- Visual styling of cards, overlay, customize mode controls
- Mobile flat layout (no change)

