## Goal

Introduce a persistent left navigation sidebar with two sections — **Home** and **ATS** (Briefcase icon) — and make the existing top navigation menu **context-aware**: it only renders the items that belong to the currently selected sidebar section. No functionality, routes, or permissions change.

## Section → top nav mapping

- **Home** → top nav shows nothing extra (it's a single destination — `/dashboard`). The top header keeps the logo, search, create, credits, notifications, and user menu.
- **ATS** → top nav shows: Find, Jobs, Candidates, Pipeline, Analytics, Intelligence (all current items, with their existing permission gates).

Active sidebar section is derived from the current route:
- `/`, `/dashboard` → Home
- `/find`, `/jobs`, `/candidates`, `/pipeline`, `/analytics`, `/talent-intelligence` (and their nested routes like `/jobs/:id`) → ATS
- Other routes (`/settings`, `/members`, `/billing`, etc.) → no section highlighted; top nav stays empty (these are reached via the user menu, not the sidebar).

Clicking **ATS** in the sidebar navigates to `/jobs` (the canonical ATS landing) so the top nav populates immediately.

## Layout changes

`src/components/layout/Layout.tsx`:
- Wrap content in a flex row: fixed-width sidebar on the left, existing `Header` + `<Outlet />` on the right.
- Sidebar is desktop-only (`hidden sm:flex`); mobile keeps the existing `MobileBottomNav` untouched.
- Adjust `<Header>` left offset / width so it sits to the right of the sidebar (sidebar width reserved with left padding on the fixed header, or the header becomes non-fixed within the right column — pick the option that preserves the existing scroll-shadow behavior).

New file `src/components/layout/AppSidebar.tsx`:
- Narrow icon-first sidebar (~64px) using semantic tokens (`bg-surface-primary`, `border-virgilio-border`, active state `bg-virgilio-purple text-white`, hover `bg-virgilio-purple/10`), Poppins labels.
- Two items: Home (`Home` icon) and ATS (`Briefcase` icon). Each shows an icon + label, with the active section visually highlighted using the same treatment as the current top nav active state for consistency.

## Header changes

`src/components/layout/Header.tsx`:
- Keep the existing `navigationItems` array but tag each with a `section: 'home' | 'ats'`.
- Compute `activeSection` from `location.pathname` (same logic as sidebar).
- Filter the rendered nav (both desktop and mobile sheet) to items where `item.section === activeSection`. Home (`/dashboard`) is removed from the top nav since it's now a sidebar destination.
- Mobile sheet keeps showing all permitted items grouped by section (mobile has no sidebar), so behavior on small screens is unchanged.

## Out of scope

- No route changes, no permission changes, no removal of pages.
- Mobile bottom nav untouched.
- No new pages or CRM features yet — this PR is purely the navigational reorganization to prepare for the CRM section to be added later as a third sidebar entry.

## Files touched

- `src/components/layout/Layout.tsx` (wrap with sidebar)
- `src/components/layout/Header.tsx` (section-aware filtering, drop Home from top nav)
- `src/components/layout/AppSidebar.tsx` (new)
