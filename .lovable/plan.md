

# Hide Mobile Header & Make Settings Responsive

## 1. Hide Header on Mobile

**File: `src/components/layout/Header.tsx`**
- Add `hidden sm:block` to the outermost `<header>` element so the entire header is hidden on mobile.

**File: `src/components/layout/Layout.tsx`**
- Remove the `pt-12` mobile top padding from `<main>` since there's no header. Keep `sm:pt-14` for desktop.

## 2. Make Settings Page Responsive

**File: `src/pages/Settings.tsx`**
- The settings page currently uses a `lg:hidden` mobile header with a Sheet for the sidebar, and a `hidden lg:block` desktop sidebar. The sidebar card is fixed at `w-64` which doesn't work on small screens.
- Replace the mobile Sheet approach: on mobile, show the `SettingsSidebar` directly (full-width, no card wrapper) at the top of the page instead of inside a Sheet drawer. When a tab is selected, show the content below.
- Alternatively (simpler): keep the current Sheet approach but fix the `SettingsMobileHeader` to work without the top header — remove the logout button (already in bottom nav), keep just the menu toggle and a "Settings" title.

**File: `src/components/settings/SettingsSidebar.tsx`**
- Make the card responsive: on mobile remove the fixed `w-64` and card wrapper, render as a simple full-width nav list.

### Recommended approach for Settings mobile:
- Keep the existing Sheet-based sidebar approach (hamburger menu opens sidebar in a drawer)
- Update `SettingsMobileHeader`: remove logout button (redundant with bottom nav), show "Settings" as title, keep hamburger to open sidebar sheet
- Change the sidebar `Card` to be `w-full` on mobile inside the sheet (it already gets `w-80` sheet width)
- Ensure content area has proper padding on mobile

## Files to Edit

| File | Change |
|---|---|
| `src/components/layout/Header.tsx` | Add `hidden sm:block` to `<header>` |
| `src/components/layout/Layout.tsx` | Adjust mobile top padding to `pt-0 sm:pt-14` |
| `src/components/settings/SettingsMobileHeader.tsx` | Remove logout button, simplify to hamburger + "Settings" title |
| `src/components/settings/SettingsSidebar.tsx` | Accept responsive width via className prop (already supported) |
| `src/pages/Settings.tsx` | Adjust mobile padding/spacing, ensure content renders well on small screens |

