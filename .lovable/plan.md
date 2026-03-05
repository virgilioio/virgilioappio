

# AI Banner — Three Tweaks

## Changes: `src/components/candidates/ExpandableScoreDisplay.tsx`

### 1. Smaller Gio avatar (line 72)
- `h-8 w-8` → `h-6 w-6`

### 2. Thinner gradient border (line 64)
- `p-[2px]` → `p-[1px]`

### 3. Fix background — lilac, not gradient (line 70)
The inner button already has `bg-pastel-purple/30`, which is correct. However, because the outer wrapper uses a gradient with `p-[2px]` and the inner uses a semi-transparent background (`/30`), the gradient bleeds through. Fix: change to a fully opaque lilac background so the gradient only shows as the border, not through the interior.
- Change inner button from `bg-pastel-purple/30` to `bg-pastel-purple` (or use a solid card color with a lilac overlay)

All three are single-line class changes on lines 64, 70, and 72. The cursor-following gradient border effect on the outer wrapper remains unchanged.

