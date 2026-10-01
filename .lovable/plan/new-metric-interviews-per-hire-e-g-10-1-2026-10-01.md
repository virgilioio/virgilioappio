# New metric: Interviews per hire (e.g. 10:1)

## What it measures
For the selected period and filters:
- **Screenings:** candidates whose first interview in a job's pipeline was scheduled in the period. One per candidate per job, so follow-up rounds don't count and cancelled interviews are left out.
- **Hires:** the same hires the Hires card counts, by their real hire date.
- **Shown as** `10:1` (screenings ÷ hires, rounded to one decimal, e.g. `7.5:1`). It shows "—" when there are no hires and the number of screenings underneath. A lower number is better.

## Where it appears
- A new **"Interviews per hire"** choice in the metric list when you create or edit a widget, under Recruiting.
- It works as a KPI card, a table, bars or columns. You can split it by **Job** or **Recruiter**, and each row shows its own ratio, e.g. "Senior PM — 12:1". A line chart shows the ratio month by month, with months without hires left blank.
- The KPI card's subtext shows the counts, e.g. "40 screenings · 4 hires".
- It's added to the default "Recruiting overview" dashboard for new views only. Existing saved dashboards are left as they are.

## Check
- I'll compare the widget's numbers against the database for last 30 days, last 90 days and one job, and report them to you.

## Technical details
- `types.ts`: add `'interviews_per_hire'` to MetricId, `'ratio'` to Format. `metrics.ts`: entry (tone blue, icon Repeat, format ratio, deltaGood down, recruiting).
- New `src/hooks/analytics/useInterviewsPerHireMetrics.ts`: fetch non-cancelled `scheduled_bookings` (job_id, candidate_id/association, scheduled_start, created_at) for `finalJobIds`. Take the earliest booking per (candidate, job) and count those whose scheduling date (`created_at`) falls in range. Hires use `job_candidate_associations` status=hired with `eventAt()`. Return totals, per-job, per-recruiter (via job_assignments / hiring_team, as in the recruiter hook) and a monthly series.
- Register in `AnalyticsDataContext` bundle. Add a case in `useWidgetData` for value, breakdown and series.
- Ratio formatting is added to the shared value formatter (KPI, table and axis labels), with "—" when there are no hires.
- Availability matrix for metric × groupBy: allow none / time / job / recruiter for this metric.
- Before building, check which `scheduled_bookings` column links a booking to the candidate (`candidate_id` or `association_id`).
