

## Add "Time to Hire" Metric Card to Analytics Dashboard

### What It Does
Adds a new metric card showing the **average number of days** from when a candidate was created in the system to when they were marked as hired. This metric respects all existing filters (date range, recruiters, jobs, departments, job status) and is strictly tenant-bound.

### Calculation Logic
For each candidate association with `status = 'hired'` within the selected date range:
- **Start**: `created_at` (when the candidate entered the system for that job)
- **End**: `updated_at` (when they were marked as hired)
- **Result**: Average of all individual durations, displayed in days (e.g., "18d")

If no hires exist in the range, it displays "N/A".

### Files Changed

**1. `src/hooks/useAnalyticsMetrics.ts`**
- Add `avgTimeToHire` (number | null) to the `AnalyticsMetrics` interface and return value
- In the query function, after computing `totalHires`, calculate the average days between `created_at` and `updated_at` for all hired associations within the date range
- Return the rounded average (or null if no hires)

**2. `src/pages/Analytics.tsx`**
- Add a new metric card object to the `metricCards` array for "Avg Time to Hire"
- Use the `Clock` icon (already imported pattern exists in other pages)
- Display value as `Xd` or `N/A`
- Update the grid from 6 columns to 7 (adjusting `lg:grid-cols-6` to `lg:grid-cols-7`) or keep at 6 and let it wrap naturally -- keeping 6 columns and adding a 7th card that wraps to the next row is cleaner

### No New Dependencies or Database Changes Required
The data needed (`created_at`, `updated_at`, `status`) is already fetched in the existing associations query. No new Supabase calls needed. Tenant isolation is already enforced by the existing `tenant_id` filtering on the jobs query.

