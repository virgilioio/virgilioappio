

# Upgrade Compensation Insights to KDE + Histogram Style

## What

Replace the current simple bar chart in `CompensationInsights` with the same Glassdoor-style hybrid visualization used in `SalaryInsightsCard`: a KDE smooth curve overlaid on histogram bars, with Low/Average/High reference lines, an annual/monthly toggle, and summary stats below.

## Changes

### 1. `src/hooks/useTalentInsightsData.ts`
- Add `salaryValues: number[]` (the raw normalized annual salary array) to the `TalentInsightsData` interface and return value
- This gives `CompensationInsights` the raw data needed for KDE computation

### 2. `src/components/talent-insights/CompensationInsights.tsx` — full rewrite
- Accept `salaryValues: number[]` as a new prop (in addition to existing `salaryStats`)
- Remove `salaryBands` prop (no longer needed — histogram is computed dynamically)
- Add annual/monthly toggle using `Switch`
- Reuse the same `generateHistogram`, `generateKDE`, and `mergeChartData` functions from `SalaryInsightsCard`
- Render `ComposedChart` with:
  - `Bar` for histogram bins (purple 15% opacity fill)
  - `Area` for KDE curve (purple stroke + gradient fill)
  - `ReferenceLine` markers for Low, Average, High
- Show Low / Average / High summary stats below the chart
- Keep existing Card + CardHeader wrapper styling (Virgilio design system)

### 3. `src/pages/TalentInsights.tsx`
- Pass `salaryValues={data.salaryValues}` instead of `salaryBands` to `CompensationInsights`

## Technical Detail

The KDE and histogram utility functions will be extracted into a shared file or duplicated in the component (they're ~50 lines total). The chart uses `recharts` `ComposedChart` which is already installed.

