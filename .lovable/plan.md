

# Three-Part Standardization: Candidates Layout, Filter Chips Everywhere, Metric Cards

## 1. Candidates Page — Move Actions Inline with Filters, Handle Search

**Current state:** The `IndependentCandidateTable` has a search bar + "Add Candidate" + "Select" button in the `CardHeader`, then filter chips below in `CardContent`. This creates two separate toolbar rows.

**Proposed change:** Merge into a single unified toolbar row:
- Filter chips (Status, Source, Country, Seniority, Skills, More Filters) come first
- "Add Candidate" and "Select" buttons sit at the right end of the same row
- "Clear filters" appears inline when active
- **Search bar recommendation:** Keep it but make it compact — integrate it as the first element in the row with a smaller width, or place it as a search icon that expands. Given the filter chips already take space, I recommend keeping a compact search input at the start of the chip row (same pattern as Jobs currently has, but styled smaller to coexist with chips).

**Files to modify:**
- `src/components/candidates/IndependentCandidateTable.tsx` — restructure the header to put search (compact), filter chips, and action buttons all in one `flex-wrap` row

## 2. Implement Filter Chips in Jobs and Pipeline

### Jobs Page (`JobsTable.tsx`)
**Current state:** Uses `Select` for status, `MultiSelect` for organization and user filters, plus a search input. All in a `CardHeader`.

**Proposed change:**
- Replace `Select` (status) with `FilterChipPopover` using status options
- Replace `MultiSelect` (organization) with `FilterChipPopover`
- Replace `MultiSelect` (user) with `FilterChipPopover`
- Keep search input compact at the start
- Move "Create Job" button to the right end of the same row
- Add "Clear filters" when any filter is active

**Files to modify:**
- `src/components/jobs/JobsTable.tsx` — replace Select/MultiSelect with FilterChipPopover, restructure header layout

### Pipeline Page (`FilterCard.tsx`)
**Current state:** Uses `Input` for search, `Select` for job status, `MultiSelect` for users and departments. Wrapped in a collapsible `Card`.

**Proposed change:**
- Remove the Card wrapper and Collapsible pattern — use a flat chip bar instead (consistent with Candidates)
- Replace `Select` (job status) with `FilterChipPopover`
- Replace `MultiSelect` (users) with `FilterChipPopover`
- Replace `MultiSelect` (departments) with `FilterChipPopover`
- Keep search input compact
- Add "Clear filters" when active
- Remove the "Advanced" collapsible (it's empty placeholder anyway)

**Files to modify:**
- `src/components/pipeline/FilterCard.tsx` — rewrite to use FilterChipPopover, remove Card/Collapsible wrapper
- `src/pages/Pipeline.tsx` — may need minor layout adjustments

## 3. Standardize Metric Cards + Add to Style Guide

### Problem
There are currently 3 metric card variants:
1. **`MetricCard`** (`src/components/ui/metric-card.tsx`) — used in Pipeline (via `PipelineMetricCard`), Jobs, Talent Intelligence, SaaS Customer Detail. Has `backgroundColor`/`iconColor` props (Pipeline uses pastel backgrounds like `#c5f5fb`), large `text-3xl` value.
2. **`AnalyticsKpiCard`** — used in Analytics. Compact, `text-2xl`, icon in purple tinted circle, trend indicator support, loading skeleton.
3. **`PipelineMetricCard`** — thin wrapper around `MetricCard` that passes custom background colors.

### Standardization approach
The user loved the `AnalyticsKpiCard` pattern. Consolidate onto that as the standard:

- **Upgrade `MetricCard`** to support the same features as `AnalyticsKpiCard`: trend indicators, suffix, loading skeleton, compact layout
- **Or** rename/promote `AnalyticsKpiCard` as the new standard `MetricCard` and migrate all consumers

**Recommended:** Merge the best of both into the existing `MetricCard`:
- Add `trend`, `suffix`, `isLoading` props from `AnalyticsKpiCard`
- Keep `icon` accepting both `ReactNode` and `LucideIcon` for flexibility
- Remove `backgroundColor`/`iconColor` — always use the Virgilio purple tinted circle pattern (consistent branding)
- Keep `footer` prop for extended use cases
- Compact layout: `text-2xl` value, `text-xs` title, icon in `bg-virgilio-purple/10` circle
- Add optional sparkline support inspired by the reference image (small inline trend line above the value)

**Migration:**
- Update `PipelineMetricCard` to use new standardized card (remove custom background colors)
- Update `Pipeline.tsx` metric cards
- Update `JobAnalyticsDashboard.tsx` metric cards
- Update `JobOverviewTab.tsx` metric cards
- Update `SummaryMetricsRow.tsx` (Talent Intelligence) metric cards
- Update `SaaSCustomerDetail.tsx` metric cards
- Remove `AnalyticsKpiCard` (fold into `MetricCard`) or keep as thin re-export
- Remove `PipelineMetricCard` wrapper

### Style Guide Addition
Create `src/components/settings/styleguide/MetricCardGuide.tsx`:
- Show the standard metric card in various configurations: basic, with trend, with suffix, loading state, with tooltip
- Register in `StyleGuide.tsx`

## Files Summary

**Create:**
1. `src/components/settings/styleguide/MetricCardGuide.tsx`

**Modify:**
1. `src/components/ui/metric-card.tsx` — consolidate with AnalyticsKpiCard features
2. `src/components/candidates/IndependentCandidateTable.tsx` — inline actions with filter chips
3. `src/components/jobs/JobsTable.tsx` — replace Select/MultiSelect with FilterChipPopover
4. `src/components/pipeline/FilterCard.tsx` — rewrite with FilterChipPopover
5. `src/pages/Pipeline.tsx` — update metric cards to standardized version, minor layout
6. `src/components/pipeline/PipelineMetricCard.tsx` — simplify or remove
7. `src/components/analytics/shared/AnalyticsKpiCard.tsx` — make thin wrapper of new MetricCard or keep
8. `src/components/analytics/sections/OverviewSection.tsx` — use standardized card
9. `src/components/analytics/sections/InterviewHealthSection.tsx` — use standardized card
10. `src/components/jobs/JobAnalyticsDashboard.tsx` — use standardized card
11. `src/components/jobs/JobOverviewTab.tsx` — use standardized card
12. `src/components/talent-intelligence/SummaryMetricsRow.tsx` — use standardized card
13. `src/pages/settings/saas-customers/SaaSCustomerDetail.tsx` — use standardized card
14. `src/components/settings/StyleGuide.tsx` — add MetricCardGuide

