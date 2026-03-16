

# Add Candidate Source Charts to Job Dashboard and Analytics Page

## Overview

Add a source distribution donut chart (matching the exact visual system of `CandidateStatusPieChart`) to both the Job Analytics Dashboard and the Analytics Source Performance section. The donut uses the standard pattern: inner/outer radius, center stat, colored-dot chip legend, pill tooltip with Poppins font and purple shadow.

## Changes

### New: `src/components/analytics/charts/SourceDonutChart.tsx`
- Donut chart component following the exact `CandidateStatusPieChart` pattern
- Props: `data: { source: string; total: number }[]`, `isLoading?: boolean`
- Donut with `innerRadius="55%"`, `outerRadius="80%"`, `paddingAngle={2}`, no stroke
- Center stat showing total count
- Colored-dot chip legend below
- Pill tooltip with `borderRadius: 16px`, Poppins font, purple shadow
- Uses Virgilio brand color palette (`--virgilio-purple`, `--info`, `--success`, `--warning`, etc.)
- Wrapped in `AnalyticsChartCard` with Globe icon

### Modified: `src/hooks/useJobAnalyticsMetrics.ts`
- Add `candidate_id` to the associations select query
- Fetch candidate sources from `candidates` table using the candidate IDs (batched in 500s like `useSourcePerformanceMetrics`)
- Aggregate into `sourceDistribution: { source: string; total: number }[]` using the same `normalizeSource` logic
- Add `sourceDistribution` to the return interface and default

### Modified: `src/components/jobs/JobAnalyticsDashboard.tsx`
- Import `SourceDonutChart`
- Add it to the charts grid alongside existing charts
- Pass `sourceDistribution` and `isLoading` from `useJobAnalyticsMetrics`

### Modified: `src/components/analytics/sections/SourcePerformanceSection.tsx`
- Replace `SourceBarChart` with `SourceDonutChart` in the left column of the grid
- The table card remains as-is on the right

## Files

| File | Change |
|------|--------|
| `src/components/analytics/charts/SourceDonutChart.tsx` | New — donut chart matching visual system |
| `src/hooks/useJobAnalyticsMetrics.ts` | Add candidate source fetching + aggregation |
| `src/components/jobs/JobAnalyticsDashboard.tsx` | Add SourceDonutChart to charts grid |
| `src/components/analytics/sections/SourcePerformanceSection.tsx` | Swap bar chart for donut |

