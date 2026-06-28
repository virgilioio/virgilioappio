## Problem
When a metric resolves to 0 or no rows, widgets render "No data in this range" which feels like an error. For numeric metrics, showing `0` (in the correct format/currency) is more accurate and reassuring.

## Fix

### `src/components/analytics/model/useWidgetData.ts`
Soften the `empty` flag:
- KPI (`groupBy === 'none'`): never empty — `0` is a valid value. Set `empty = false` when `value` is a number (including 0). Only stay `empty` if `value` is `null/undefined` (true unknown).
- Time series (`groupBy === 'time'`): if all points are 0, keep `empty = false` so the chart renders a flat line at 0 instead of swapping to a message.
- Breakdown (other group-bys): keep `empty = true` only when the breakdown array is literally empty (no categories to draw). This is the only case where a "0" doesn't make sense (no bars/columns/donut slices to show).

### `src/components/analytics/widgets/WidgetFrame.tsx`
Replace the "No data in this range" error-toned copy with a calm zero-state for breakdown vizzes:
- Render the metric's formatted `0` (using the existing `formatMetricValue` helper / metric format + currency) centered in the body, in muted typography.
- Keep the same height so layout doesn't jump.

### KPI chart
`KpiChart` already renders `value`; with the new `empty` logic it will naturally display `$0`, `0%`, or `0` per the metric's format. No change needed beyond ensuring it isn't short-circuited by the empty branch in `WidgetFrame`.

## Out of scope
- No change to how metrics compute values, query the DB, or scope by filters.
- No change to loading spinner behavior.
