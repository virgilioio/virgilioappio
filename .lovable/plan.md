

# 3:3:2 Grid Rebalance + Overflow Fixes

## Changes — `src/components/candidates/ApplicationReviewSheet.tsx`

### 1. Grid: `grid-cols-4` → `grid-cols-8`
- Column 1 (Resume): `col-span-2` → `col-span-3`
- Column 2 (Tabs): `col-span-1` → `col-span-3`, add `overflow-hidden min-w-0` to prevent bleed
- Column 3 (Controls): `col-span-1` → `col-span-2`

### 2. Middle column overflow fix
Add `min-w-0 overflow-hidden` on the column div and `overflow-x-auto` on the `TabsList` so tabs scroll horizontally on narrow screens instead of bleeding out.

### 3. Controls column — prevent horizontal scroll
- Buttons row: Change from 3 side-by-side (`flex gap-2`) to a vertical stack (`flex flex-col gap-2`) so Reject/Pass/Advance don't overflow
- Cards: Add `overflow-hidden` to prevent content bleed

Single file, ~6 small class/layout tweaks.

