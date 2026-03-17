

# Dialog Tweaks: 4:3:1 Ratio, Less Height, Top-Aligned Buttons

## Changes to `IntegrationDetailDialog.tsx`

### 1. Reduce height
- `min-h-[440px]` → `min-h-[340px]` and add `max-h-[70vh]` to cap the dialog height

### 2. New 4:3:1 ratio (out of 8 parts)
- **Left — Carousel**: `sm:w-[50%]` (4/8)
- **Center — Description**: `sm:w-[37.5%]` (3/8), with `overflow-y-auto` and a max height so text scrolls
- **Right — Actions**: `sm:w-[12.5%]` (1/8)

### 3. Top-align action buttons
- Change `justify-center` → `justify-start` on the actions column so buttons sit at the top

### File
| File | Lines | Change |
|------|-------|--------|
| `IntegrationDetailDialog.tsx` | 134–196 | Update ratios, reduce min-h, add max-h, top-align buttons |

