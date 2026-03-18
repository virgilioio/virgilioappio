

# Mobile Bottom Navigation Bar

## Overview
Create a fixed bottom navigation bar for mobile (`< sm`) with 4 items: **Home**, **Pipeline**, **Analytics**, and **Profile avatar** (opens the same user dropdown menu). Simplify the mobile header by hiding redundant elements.

## Changes

### 1. Create `src/components/layout/MobileBottomNav.tsx`
- Fixed bottom bar, only visible on mobile (`sm:hidden`)
- 4 tabs: Home (`/dashboard`), Pipeline (`/pipeline`), Analytics (`/analytics`), Profile avatar (triggers DropdownMenu with Settings, Log out)
- Active state uses `virgilio-purple` styling, matching existing nav patterns
- Uses same permission checks (`canViewJobs`, `isAdmin`, etc.) for Pipeline/Analytics visibility — fall back gracefully if user lacks permission (still show the tab but navigate to dashboard)
- Safe area padding for iOS (`pb-safe` / `env(safe-area-inset-bottom)`)
- Background: `bg-surface-primary/95 backdrop-blur border-t border-virgilio-border`

### 2. Edit `src/components/layout/Layout.tsx`
- Import and render `<MobileBottomNav />` alongside `<Header />`
- Add bottom padding on mobile to prevent content being hidden behind the bar: `pb-16 sm:pb-0` on `<main>`

### 3. Edit `src/components/layout/Header.tsx`
- On mobile (`sm:hidden`): hide the hamburger menu popover, notification center, sourcing credits, search bar, and user avatar — these are either in the bottom nav or not needed on mobile
- Keep only the logo visible in the mobile header (minimal top bar)
- Desktop remains completely unchanged

## Files

| File | Action |
|---|---|
| `src/components/layout/MobileBottomNav.tsx` | **Create** |
| `src/components/layout/Layout.tsx` | **Edit** — add bottom nav + main padding |
| `src/components/layout/Header.tsx` | **Edit** — hide redundant mobile elements |

