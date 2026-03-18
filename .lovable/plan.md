

# Mobile UI Improvements

## Changes

### 1. Analytics Page — Fix mobile layout (`src/pages/Analytics.tsx`)
- Hide "Export Report" button on mobile: add `hidden sm:flex` to the button
- Move the time filter below the title on mobile: restructure PageHeader children so the filter wraps below on small screens (use `flex flex-col sm:flex-row` or place filter outside PageHeader on mobile)

### 2. Dashboard — Hide cards on mobile (`src/pages/Dashboard.tsx`)
- Wrap `RecentSourcingProjects` and `JobsOverview` with `hidden sm:block` so they're hidden on mobile

### 3. Redesign Mobile Bottom Nav (`src/components/layout/MobileBottomNav.tsx`)

New tab order: **Pipeline | Analytics | Home (Gio avatar) | Search | Profile**

- **Pipeline** — `/pipeline` with TrendingUp icon
- **Analytics** — `/analytics` with BarChart3 icon
- **Home** — center position, uses the user's avatar (larger, ~10-11 size) as button, links to `/dashboard`
- **Search** — Search icon, opens `SearchResultsDialog` (the existing full search dialog already used by GlobalSearchBar's mobile button)
- **Profile** — existing dropdown with Settings/Logout

**Floating card style**: Change the container from edge-to-edge fixed bar to a floating card with margins (`mx-4 mb-3`), rounded corners (`rounded-2xl`), and the existing glass effect (`bg-surface-primary/80 backdrop-blur-xl border border-virgilio-border shadow-lg`). Remove `border-t` (replaced by full border).

**Center avatar**: The Home tab avatar gets `h-10 w-10` (vs `h-6 w-6` for Profile) with a ring/border effect (`ring-2 ring-virgilio-purple`) to make it the focal point, slightly raised with negative margin.

Import `SearchResultsDialog` and manage `isDialogOpen` state for the search tab. Also import `Search` icon from lucide.

### 4. Layout padding adjustment (`src/components/layout/Layout.tsx`)
- Increase mobile bottom padding from `pb-16` to `pb-20` to account for the floating nav with margins

## Files

| File | Change |
|---|---|
| `src/pages/Analytics.tsx` | Hide export button on mobile, move time filter below title |
| `src/pages/Dashboard.tsx` | Hide RecentSourcingProjects and JobsOverview on mobile |
| `src/components/layout/MobileBottomNav.tsx` | Redesign: new tab order, floating card, center avatar, search tab |
| `src/components/layout/Layout.tsx` | Adjust bottom padding for floating nav |

