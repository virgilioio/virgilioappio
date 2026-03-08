

# Add Missing Sparklines to Avg Time to Hire, Offers, and Rejected

## Problem
Three cards have no sparkline because the underlying `trendData` doesn't include daily values for offers, rejected, or avg time to hire. The hook only computes `applications`, `active`, `hires`, and `interviewsScheduled` per day.

## Plan

### 1. Extend `trendData` in `useAnalyticsMetrics.ts`
Add three new fields to each day's trend object:
- **`offers`**: count of associations with `status === 'offer'` where `updated_at` falls on that day
- **`rejected`**: count of associations with `status === 'rejected'` where `updated_at` falls on that day
- **`interviewsCompleted`**: count of bookings where `scheduled_start` is in the past and falls on that day

Update the `AnalyticsMetrics` interface's `trendData` type to include these new fields.

### 2. Extend `trendData` in `useJobAnalyticsMetrics.ts`
Same approach — add `offers`, `rejected`, and `interviewsCompleted` daily values to the job-level trend data for consistency.

### 3. Wire sparklines in `OverviewSection.tsx`
- **Avg Time to Hire**: Use `hiresSparkData` (hires trend) with a warning/orange color — this shows hiring activity over time which correlates with the metric
- **Offers**: `trendData.map(d => d.offers)` — info/blue color
- **Rejected**: `trendData.map(d => d.rejected)` — destructive/red color

### Files to modify
| File | Change |
|------|--------|
| `src/hooks/useAnalyticsMetrics.ts` | Add `offers`, `rejected`, `interviewsCompleted` to daily trendData |
| `src/hooks/useJobAnalyticsMetrics.ts` | Same extension for job-level analytics |
| `src/components/analytics/sections/OverviewSection.tsx` | Wire sparklines to the 3 missing cards |

