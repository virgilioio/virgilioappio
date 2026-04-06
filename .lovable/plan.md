

# Redesign Photo Widget UX: Dropdown Menu + Edit Mode

## Current Problem
The trash icon floating over the photo feels crude. The plus button at the bottom is disconnected. There's no way to reorder photos or manage the carousel holistically.

## New UX Design

```text
Normal Mode:
┌─────────────────────┐
│                 [⋯] │  ← ellipsis menu (top-right, semi-transparent pill)
│                     │
│    [photo image]    │
│                     │
│  [◀]          [▶]  │  ← arrows on hover (unchanged)
├─────────────────────┤
│ ● ○ ○              │  ← dot indicators (unchanged)
└─────────────────────┘

Dropdown Menu (from ⋯):
┌─────────────────┐
│ 📷 Upload Photo │
│ ✏️ Edit Carousel │
└─────────────────┘

Edit Mode (replaces normal view):
┌─────────────────────┐
│  Edit Carousel [Done]│
├─────────────────────┤
│ [thumb][thumb][thumb]│  ← draggable thumbnails with × badges
│  [+ Add]            │
└─────────────────────┘
```

## Implementation

### `src/components/dashboard/PhotoCarouselWidget.tsx`

1. **Replace trash icon + plus button** with a single `MoreHorizontal` (ellipsis) icon at top-right of the photo area, styled like the existing delete button (semi-transparent pill, always visible when photos exist)

2. **Add DropdownMenu** with two items:
   - "Upload Photo" — triggers `fileInputRef.click()` (disabled if at max)
   - "Edit Carousel" — sets `isEditing = true` (disabled if no photos)

3. **Add edit mode** (`isEditing` state):
   - Replaces the photo display area with a grid of small thumbnails
   - Each thumbnail has an "×" button (top-right corner, same style as dashboard widget hide controls)
   - Thumbnails are drag-reorderable using simple array index swap (click-to-select + move buttons, or basic drag)
   - A small "+ Add" button at the end to upload more
   - "Done" button in the header exits edit mode and persists the new order
   - For simplicity: use move-left/move-right arrows on selected thumbnail instead of full drag-and-drop (keeps it lightweight)

4. **Empty state**: Keep existing camera icon + "Add a photo" click area. The ellipsis menu only appears when there are photos (or show it always with just "Upload Photo" enabled).

5. **Remove**: Trash2 icon overlay, standalone Plus button from bottom bar. Bottom bar keeps only dot indicators in normal mode.

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/PhotoCarouselWidget.tsx` | Replace trash/plus with ellipsis dropdown; add edit mode with thumbnail grid, reorder, and delete |

