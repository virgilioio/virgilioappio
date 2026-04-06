

# Photo Carousel Dashboard Widget

## Concept
A personal photo frame widget — like the framed photo on your desk. 1-column (xsmall), same height as World Clock and Currency Converter (min-h-[240px]). Users upload personal photos that cycle in a carousel with dot navigation, just like the World Clock cycles through timezones.

## Design

```text
┌─────────────────┐
│  ┌─────────────┐│
│  │             ││
│  │   Photo     ││
│  │  (cover)    ││
│  │             ││
│  └─────────────┘│
│  ● ● ○         +│
└─────────────────┘
```

- Warm background matching the World Clock aesthetic (`bg-accent/40 border-accent/60`)
- Photos displayed with `object-cover` in rounded container, filling most of the card
- Bottom row: dot indicators (left) + nav arrows + upload button (right) — mirrors World Clock exactly
- Empty state: dashed border + camera icon + "Add a photo" text
- Click upload button → file picker (images only, 5MB max)
- Long-press or hover on a photo → delete option
- Photos stored in Supabase Storage (`dashboard-photos` bucket), scoped per user (`{user_id}/`)

## Storage

- **Bucket**: `dashboard-photos` (public, so images load via URL)
- **RLS**: Users can only upload/delete in their own `{user_id}/` folder
- **Photo order**: Stored in localStorage as an array of file paths (lightweight, no DB table needed)
- **Limit**: Max 10 photos to keep it lightweight

## Implementation

### 1. DB Migration — Create storage bucket + RLS
- Insert `dashboard-photos` bucket (public, 5MB limit, image mimetypes only)
- RLS policies: authenticated users can INSERT/SELECT/DELETE only under their own `user_id/` prefix

### 2. `src/components/dashboard/PhotoCarouselWidget.tsx` — New component
- State: array of photo URLs loaded from Supabase Storage by listing `{userId}/` prefix
- Carousel: manual index with dot navigation + chevron arrows (same pattern as WorldClockWidget)
- Upload: file input → validate image + size → upload to `dashboard-photos/{userId}/{uuid}.{ext}`
- Delete: small trash icon on hover/tap → remove from storage + state
- Empty state with dashed border + Camera icon
- `min-h-[240px]` + flex column layout matching sibling widgets

### 3. `src/hooks/useDashboardLayout.ts` — Register widget
- Add `'photo-carousel'` to `DashboardCardId` union
- Add to `WIDGET_REGISTRY`: xsmall, fixed, label "Photo Frame"
- Add to `ALL_CARD_IDS`

### 4. `src/pages/Dashboard.tsx` — Wire up
- Import `PhotoCarouselWidget`
- Add case in `renderCard` switch
- Add to `MOBILE_ORDER`

## Files changed

| File | Change |
|------|--------|
| DB migration | Create `dashboard-photos` storage bucket with RLS policies |
| `src/components/dashboard/PhotoCarouselWidget.tsx` | New: photo carousel widget with upload/delete/navigate |
| `src/hooks/useDashboardLayout.ts` | Register `photo-carousel` as xsmall fixed widget |
| `src/pages/Dashboard.tsx` | Wire up new widget in renderCard and mobile order |

