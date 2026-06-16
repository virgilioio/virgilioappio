## Goal

Make the left sidebar's **Analytics** tile own both the **Analytics** (`/analytics`) and **Intelligence** (`/talent-intelligence`) pages. Today those two pages live under the ATS module's top-nav, and the Analytics tile points to a placeholder hub at `/insights`.

## Changes

### 1. `src/components/layout/AppSidebar.tsx`
- Update `ANALYTICS_PREFIXES` from `['/insights']` to `['/analytics', '/talent-intelligence', '/insights']` so the Analytics tile lights up on both real pages.
- Update `ATS_PREFIXES` to drop `/analytics` and `/talent-intelligence` (they no longer belong to ATS).
- Change the Analytics tile `href` from `/insights` → `/analytics` so clicking the tile lands on the real Analytics dashboard.

### 2. `src/components/layout/Header.tsx`
Reassign the two nav items so they appear in the top-nav only when the Analytics module is active:
- `{ href: '/analytics', label: 'Analytics', section: 'analytics' }`
- `{ href: '/talent-intelligence', label: 'Intelligence', section: 'analytics' }`

The header already filters `visibleNavItems` by `activeSection`, so once the sidebar marks `/analytics` and `/talent-intelligence` as the `analytics` section, the header will automatically show only these two tabs when in the module, and ATS will show only Find / Jobs / Candidates / Calendar / Pipeline.

### 3. `src/App.tsx` (`/insights` route)
The `AnalyticsHub` placeholder at `/insights` becomes redundant. Replace its route with a redirect to `/analytics` (keep the path so any old links don't 404). No file deletion needed.

## Out of scope
- No changes to the Analytics page itself, the Intelligence page, permissions, or mobile bottom nav (which uses its own item list).
- No copy changes beyond what's already there.

## Verification
- Click left sidebar Analytics → lands on `/analytics`, tile is active, top header shows two tabs: Analytics, Intelligence.
- Navigate to `/talent-intelligence` → Analytics tile stays active, Intelligence tab highlighted.
- Navigate to `/jobs` → ATS tile active, top header shows ATS tabs only (no Analytics/Intelligence).
- Visiting `/insights` redirects to `/analytics`.
