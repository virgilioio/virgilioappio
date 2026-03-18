

# Hide Filter Chips on Mobile Behind a "Filters" Button

## Problem
On mobile (390px), filter chip bars in multiple pages wrap into multiple rows, consuming valuable screen real estate.

## Approach
Create a reusable wrapper component `MobileFilterDrawer` that:
- On **desktop** (`sm:` and up): renders filter chips inline as today (no change)
- On **mobile** (`< sm`): hides the chips and shows a single "Filters" icon button that opens a `Sheet` containing all the filter chips stacked vertically

This component wraps any set of filter chips via `children`.

## Component: `src/components/ui/mobile-filter-drawer.tsx`

A wrapper that uses `useIsMobile()` to decide rendering:
- **Desktop**: renders `children` inline (fragment)
- **Mobile**: renders a `SlidersHorizontal` icon button (with active filter count badge). On click, opens a bottom/right `Sheet` containing the `children` stacked vertically with proper spacing. Includes a "Clear filters" and "Apply" footer.

```tsx
// Simplified API
<MobileFilterDrawer activeFilterCount={3} onClearAll={clearAll}>
  <FilterChipPopover ... />
  <FilterChipPopover ... />
  ...
</MobileFilterDrawer>
```

## Pages to Update

Each page wraps its `FilterChipPopover` elements (and "Clear filters" button) in `MobileFilterDrawer`:

| Location | File | Filter chips |
|---|---|---|
| **Pipeline** | `FilterCard.tsx` | Status, User, Department |
| **Jobs** | `JobsTable.tsx` | Status, Organization, User |
| **Candidates** | `CandidateFiltersPanel.tsx` | Job, Stage, Status, Source, Country, Seniority, Skills, Pipeline, Rejected at Stage, More Filters |
| **Analytics** | `AnalyticsFiltersBar.tsx` | Status, Recruiter, Job, Department |
| **Talent Intelligence** | `TalentIntelligenceFilterBar.tsx` | Job, Role, Seniority, Status, Pipeline, Stage, Country, Skills, Salary slider, More Filters |
| **Integrations** | `IntegrationsTab.tsx` | Category, Status |

For each: wrap the `FilterChipPopover` elements in `<MobileFilterDrawer>`. The search input and action buttons (Add Candidate, Create Job, etc.) remain visible outside the drawer on mobile.

## Implementation Details

- The `Sheet` renders from the right side, reusing the existing `Sheet` component
- Inside the sheet, chips render in a vertical `flex flex-col gap-3` layout so each popover gets its own row — more touch-friendly
- The trigger button matches the existing chip styling: `h-8 rounded-full border text-sm font-poppins` with a `SlidersHorizontal` icon
- Active filter count shown as a small `Badge` on the button
- `SavedViewSelector` stays outside the drawer (always visible)
- On desktop, the component is transparent — just renders children inline

## Files to Create/Edit

| File | Action |
|---|---|
| `src/components/ui/mobile-filter-drawer.tsx` | **Create** — new reusable component |
| `src/components/pipeline/FilterCard.tsx` | **Edit** — wrap chips in `MobileFilterDrawer` |
| `src/components/jobs/JobsTable.tsx` | **Edit** — wrap chips in `MobileFilterDrawer` |
| `src/components/candidates/CandidateFiltersPanel.tsx` | **Edit** — wrap chips in `MobileFilterDrawer` |
| `src/components/analytics/AnalyticsFiltersBar.tsx` | **Edit** — wrap chips in `MobileFilterDrawer` |
| `src/components/talent-intelligence/TalentIntelligenceFilterBar.tsx` | **Edit** — wrap chips in `MobileFilterDrawer` |
| `src/components/settings/IntegrationsTab.tsx` | **Edit** — wrap chips in `MobileFilterDrawer` |

