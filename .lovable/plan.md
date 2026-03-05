

# Increase Gio AI Banner Icon Size

All banner instances currently use `h-8` (2rem / 32px). Bump to `h-10` (2.5rem / 40px). The compact variant uses `h-6` — bump to `h-8`.

## Files and changes

### `src/components/settings/styleguide/AiBannerGuide.tsx`
- Line 23: Icon showcase — `h-12` → `h-14`
- Lines 38, 56: Standard & dismissible banners — `h-8` → `h-10`
- Line 88: Compact banner — `h-6` → `h-8`
- Line 107: Code snippet reference — `h-8` → `h-10`

### `src/components/candidates/ExpandableScoreDisplay.tsx`
- Line 49: `h-8` → `h-10`

### `src/components/candidates/BackgroundEnrichmentBanner.tsx`
- Line 16: `h-8` → `h-10`

### `src/components/candidates/ScorecardSheet.tsx`
- Line 985: `h-8` → `h-10`

All changes are single-class updates. No structural or layout changes needed.

