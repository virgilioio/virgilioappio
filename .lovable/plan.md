

# Upgrade Pipeline & Interviews Grouped Cards with Sparklines

## What we're doing

The "Pipeline" and "Interviews" `MetricCardGroup` strips in the Overview section currently show flat inline numbers with no sparklines. We'll redesign them to display each metric **vertically stacked** (one per row) with a sparkline on the right — matching the depth and style of the hero cards.

## Changes

### 1. Update `MetricCardGroup` layout to support vertical stacking

**File:** `src/components/ui/metric-card-group.tsx`

Add a `direction` prop (`'horizontal' | 'vertical'`, default `'horizontal'`). When `vertical`:
- Stack children with `flex-col divide-y` instead of `flex divide-x`
- Each row becomes a full-width strip with its own sparkline

### 2. Wire sparklines into Pipeline and Interviews groups

**File:** `src/components/analytics/sections/OverviewSection.tsx`

- **Pipeline group** — extract sparkline data from `trendData`:
  - Active: `trendData.map(d => d.active)` — blue accent
  - Offers: no daily offers in trendData, so skip sparkline (or show static)
  - Rejected: skip sparkline (cumulative, not daily)
- **Interviews group**:
  - Scheduled: `trendData.map(d => d.interviewsScheduled)` — purple
  - Completed: derive from trendData if available, otherwise skip

Pass `direction="vertical"` to both `MetricCardGroup` components and add `<MiniSparkline>` to each inline `MetricCard` that has trend data.

### 3. Ensure inline variant supports sparkline rendering

**File:** `src/components/ui/metric-card.tsx`

The inline variant already has a sparkline slot — just verify it renders to the right of the value row with proper sizing. Adjust the inline layout to `flex items-center` with sparkline on the far right within each row.

### Files
| Action | File |
|--------|------|
| Modify | `src/components/ui/metric-card-group.tsx` — add `direction` prop |
| Modify | `src/components/analytics/sections/OverviewSection.tsx` — vertical layout + sparklines |
| Modify | `src/components/ui/metric-card.tsx` — ensure inline sparkline renders inline to the right |

