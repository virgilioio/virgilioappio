

# Replace Jobs Overview Inline Metrics with MetricCard Components

## Problem
The Jobs Overview card uses plain `div` elements with `bg-muted/50` for its metric summaries (Open, Draft, Closed, Total). The rest of the platform (Analytics, Intelligence, Job Analytics) uses the standardized `MetricCard` component with icon circles, Poppins typography, and optional sparklines. This inconsistency breaks visual cohesion.

## Changes

### `src/components/dashboard/JobsOverview.tsx`

**Medium size (3-col, line 113-126)** — Replace the 3 plain metric divs with `MetricCard` using `variant="inline"` (compact, no card wrapper) inside a `MetricCardGroup`:
- Open → `Briefcase` icon, `text-virgilio-success` 
- Draft → `Clock` icon, `text-warning`
- Closed → `Users` icon, `text-destructive`

**Large size (4-col, line 180-197)** — Replace the 4 plain metric divs with `MetricCard` (default variant, compact grid):
- Open → `Briefcase` icon, `text-virgilio-success`
- Draft → `Clock` icon, `text-warning`
- Closed → `Users` icon, `text-destructive`
- Total → `Building` icon, `text-primary`

Both will use the existing `MetricCard` and `MetricCardGroup` components already imported across the platform, ensuring icon circles, Poppins bold values, and consistent elevation/hover behavior.

### Imports to add
- `MetricCard` from `@/components/ui/metric-card`
- `MetricCardGroup` from `@/components/ui/metric-card-group`

| File | Change |
|------|--------|
| `src/components/dashboard/JobsOverview.tsx` | Replace plain metric divs with `MetricCard`/`MetricCardGroup` in medium and large views |

