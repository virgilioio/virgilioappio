# Fix analytics date logic (Hires, Avg time to hire, Offers, Rejected)

## What's wrong (confirmed)
- Hires, offers and rejections are dated by the candidate record's "last edited" time, not by when the decision happened. Any later edit (note, tag, field change) moves a hire into a different period, so filtering by period gives the wrong numbers.
- Avg time to hire is measured from when the candidate was added up to that same "last edited" time, so later edits make it look longer.
- Avg time to hire ignores the job status filter, so it can include hires that the Hires card doesn't count.
- Only 15 of 33 hired candidates have a saved hire date; 37 rejected candidates have a last-edited date that differs from their rejection date by over a day.

## Fix
1. Use the real event dates: hire date for hires, offer date for offers, rejection date for rejections. Only fall back to the last-edited time when the real date is missing.
2. Avg time to hire = days from added to hired, for exactly the same hires the Hires card counts.
3. Apply the same rule everywhere: top cards, daily trend chart, job health table, recruiter table and the per-job analytics tab.
4. Fill in missing hire dates from the candidate's stage history (when they were moved to hired), so older hires land in the right period.
5. Check the numbers against the database for last 30 days and a custom range, and report them.

## Technical details
- `useAnalyticsMetrics.ts`: select `hired_at, offered_at, rejected_at`; helper `eventDate(a, kind)`; replace `updated_at` filters for hired/offer/rejected in totals + trend; drop the status-agnostic avg set, compute from `hiredInRange`.
- Same change in `useJobHealthMetrics`, `useRecruiterPerformanceMetrics`, `useOfferAnalyticsMetrics`, `useJobAnalyticsMetrics`.
- One-off data update: set `hired_at` from `job_candidate_stage_history` (or `updated_at` as last resort) where null on hired rows.
