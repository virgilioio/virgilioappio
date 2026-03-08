

# Analytics Filter Bar Update + Style Guide Addition

## 1. Update Analytics Filter Bar

Rewrite `src/components/analytics/AnalyticsFiltersBar.tsx` to replace the old `MultiSelect` + `Select` dropdowns with `FilterChipPopover` components, matching the Candidates and Talent Intelligence pages.

**Changes:**
- Replace Job Status `Select` with a `FilterChipPopover` (convert from single-select to multi-select; treat empty selection as "all")
- Replace Recruiters/Jobs/Departments `MultiSelect` with `FilterChipPopover`
- Remove icon prefixes (`Users`, `Briefcase`, `Building2`, `CircleDot`)
- Add "Clear Filters" link when any filter is active
- The `useAnalyticsFilterOptions` hook returns `FilterOption[]` (value/label) — we need to map these to `FilterChipOption[]` (value/label/count). Since analytics doesn't have per-option counts, we'll set count to 0 and hide counts visually, or simply pass a count of 0.
- Keep the same `onFiltersChange` callback interface — no changes needed upstream

**Note on Job Status:** Currently single-select with a default of `'open'`. We'll convert to multi-select (array of statuses) but the `AnalyticsFilters` interface uses `jobStatus: string`. We'll keep it as a single-value filter by taking the first selected value, or change the interface to `jobStatuses: string[]` — checking how `useAnalyticsMetrics` consumes it to decide.

Let me check that quickly — the hook uses `filters.jobStatus` as a single string. We'll keep it simple: use `FilterChipPopover` but treat it as single-select visually (the chip naturally handles showing the selected label). Actually, the simplest consistent approach: convert to multi-select in the interface (`jobStatuses: string[]`) and update the metrics hook to handle an array. But to minimize scope, we can keep status as a single-select `Select` dropdown styled as a chip, OR just use the chip popover and join selected statuses for the filter. I'll convert the interface to support `string[]` and update the metrics hook filter logic.

## 2. Create Filters Style Guide

Create `src/components/settings/styleguide/FiltersGuide.tsx` showcasing:

**Section 1: Filter Chip Popover** — Interactive demo with sample options (e.g., "Status" with Open/Closed/Draft, "Department" with Engineering/Design/Marketing). Shows both inactive (`⊕ Label`) and active (`Label | Value`) states.

**Section 2: Filter Sheet** — A button that opens the `FilterSheet` component with sample `FilterCheckboxGroup` sections inside.

**Section 3: Filter Checkbox Group** — Standalone demo showing the checkbox list with search, counts, and "Show more" toggle.

Register in `StyleGuide.tsx` by importing and adding `<FiltersGuide />`.

## Files to Create
1. `src/components/settings/styleguide/FiltersGuide.tsx`

## Files to Modify
1. `src/components/analytics/AnalyticsFiltersBar.tsx` — replace with `FilterChipPopover`
2. `src/components/settings/StyleGuide.tsx` — add `FiltersGuide`
3. `src/hooks/useAnalyticsMetrics.ts` — minor update if we change jobStatus to array (will check during implementation)

