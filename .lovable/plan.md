

# Show "Personal Link" Instead of "Unknown Job" for Personal Bookings

## Problem
When meetings are booked via the personal scheduling link (not tied to a job/stage), they have no `job_id` or `job_hiring_stage_id`. The UI currently falls back to "Unknown Job" which is confusing.

## Changes

### 1. `src/components/dashboard/ActivityRow.tsx` (~line 199)
Replace the fallback logic:
```
activity.jobTitle || 'Unknown Job'
```
with:
```
activity.jobTitle || (activity.interview?.job_id ? 'Unknown Job' : 'Personal Link')
```
This checks if the booking has a `job_id` -- if not, it's a personal link booking.

### 2. `src/components/dashboard/UpcomingActivities.tsx` (~line 63)
Update the `jobTitle` mapping for interview activities:
```
jobTitle: b.job?.title || (b.job_id ? 'Unknown Job' : null),
```
So personal link bookings get `null` jobTitle, which flows to ActivityRow's display logic.

### 3. `src/components/dashboard/InterviewRow.tsx` (~line 89)
Same pattern:
```
const jobTitle = booking.job?.title || (booking.job_id ? 'Unknown Job' : 'Personal Link')
```

### 4. Visual distinction (optional but nice)
In ActivityRow, when displaying "Personal Link", use a slightly different style (e.g., italic or a `Link` icon) to distinguish it from job-based interviews.

