

# Assessment: Current State vs. Utopian Dashboard

## Where you are now

**Working well (genuinely premium):**
- Customize mode entry/exit — intentional, mature
- Drag overlay — lift, shadow, rotation — polished
- Drop position indicator (before/after line) — present
- Masonry packing — no vertical gaps
- Persistence, resize, hide/show — solid
- World Clock, metric cards, visual consistency — excellent

**The remaining gap — and why swaps can't fix it:**

The current system stores widgets as an **ordered list** and uses `computePlacements` to **re-pack from scratch** every time. Even with a "swap" (only 2 widgets change order), the greedy packer re-derives ALL positions from the new sequence. Widget C at order 3 may land in a completely different grid cell because widgets A and B (which swapped around it) now occupy different slots earlier in the packing sequence.

**This is architectural.** No amount of swap vs. splice vs. insert logic can fix it, because the packer is stateless — it doesn't know where widgets *were*, only what order they're in.

## What the utopian version requires

Store **explicit grid positions** (`col`, `row`) per widget — not just an order number. When a user drags widget X below widget Y:
- Widget X gets placed at the target cell
- Widget Y (if displaced) moves to X's old position
- Everything else stays exactly where it is
- No re-packing. No sequence-based derivation.

## Plan

### 1. New layout data model in `useDashboardLayout.ts`

Replace `order`-based `WidgetLayout` with position-based:

```text
Current:  { id, size, order: number }
Proposed: { id, size, col: number, row: number }
```

`computePlacements` becomes the **initial layout generator** only (used for first load / reset). After that, positions are stored and mutated directly.

### 2. New placement logic

- **On load**: If stored layout has `col`/`row` per widget, use them directly. If migrating from old format, run `computePlacements` once to generate initial positions, then store them.
- **On drag-drop**: Set dragged widget's `col`/`row` to target position. If another widget occupies that cell, swap their positions (direct coordinate swap, not order swap). No re-packing.
- **On resize**: Only re-flow the resized widget and anything it now overlaps. Not the whole grid.
- **On show/add**: Place new widget in first available gap (use packer logic for this one case only).

### 3. MasonryGrid adaptation

`MasonryGrid` already accepts `items` with `colStart`/`colSpan`. Currently these come from `computePlacements`. Instead, derive them directly from stored `col`/`colSpan` values. The masonry engine's height-measurement and absolute-positioning stay unchanged — only the input source changes.

### 4. Drop target detection

During drag, use pointer position relative to the grid to compute the target `col`/`row` cell. Show a "ghost placeholder" at that exact cell position (a translucent rectangle matching the dragged widget's size). This replaces the current before/after line with precise spatial targeting.

### 5. Collision resolution

When dropping, if the target cells overlap an existing widget:
- **Simple case** (same size): swap positions directly
- **Different sizes**: displaced widget moves to the dragged widget's old position (if it fits) or to the nearest available gap

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardLayout.ts` | New `col`/`row` position model, migration from order-based, direct position swap on drop, storage format v4 |
| `src/pages/Dashboard.tsx` | Derive masonry items from stored positions instead of `computePlacements`, ghost placeholder during drag, grid-cell-based drop targeting |
| `src/components/dashboard/MasonryGrid.tsx` | Add optional "ghost slot" rendering for drop preview |
| `src/components/dashboard/DraggableDashboardCard.tsx` | Remove before/after line indicator (replaced by ghost placeholder) |

## Migration

Old `dashboard-layout-v3` data auto-migrates: run `computePlacements` on the stored order-based widgets to generate initial `col`/`row` values, save as `dashboard-layout-v4`.

## What this achieves

- Dragging widget X below widget Y: Y stays put, X lands exactly there
- No re-packing cascade — positions are stored, not derived
- Ghost placeholder shows precise landing zone during drag
- Only the displaced widget (if any) moves — everything else frozen
- The layout engine becomes **obedient to user intent**, not a compaction optimizer

