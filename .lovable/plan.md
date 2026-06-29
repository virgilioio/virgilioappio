## Problem
The dashboard's **Today** (calendar) card and **Open jobs** card render plain centered text when empty:
- Today → `"No events today."`
- Open jobs → `"No open jobs."`

Neither uses the canonical `<EmptyState>` primitive with a Gio mascot illustration, breaking consistency with the rest of the app (and with the Your queue card we just fixed).

## Fix
Update `src/pages/Dashboard.tsx`:

1. **TodayCard empty state** (~line 770)
   - Replace the plain text with `<EmptyState size="card" illustration={<SoftCalendar />} title="Nothing on today" body="Your schedule is clear. Newly booked interviews will show up here." />`.

2. **OpenJobsCard empty state** (~line 954)
   - Replace with `<EmptyState size="card" illustration={<SoftFlag />} title="No open jobs" body="Create a job to start tracking candidates and pipeline activity." action={<EmptyAction onClick={() => navigate('/jobs')}>Go to Jobs</EmptyAction>} />`.
   - Pass `onCreateJob`/navigate via props (OpenJobsCard already receives `onPipeline`; add a similar handler or reuse navigation).

3. Keep the existing skeleton loading states untouched — only the empty branches change.

No business-logic changes; presentation only.