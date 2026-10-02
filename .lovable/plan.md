# Hires still showing 12: find the exact drop, then fix it

## What I checked
- **The real number is 22.** Your workspace has 22 hired candidates, all hired between Aug 8, 2025 and Sep 23, 2026. Every one has a hire date, sits on a job that isn't deleted, and has a valid pipeline stage.
- **The page uses the right period.** Your preview's log shows the analytics query running with Apr 1, 2025 to Oct 1, 2026 (and later Mar 1, 2025). The dashboard has no job, recruiter or client filter.
- **Your access looks fine.** You're a platform admin in this workspace, and the access rules should let you see all 22 hires.
- **The 12 you see are exactly the hires from Mar 17, 2026 onward.** The 10 missing are every hire from before then. That points to older records being dropped somewhere between the database and the card, not to a wrong period.

I can't sign in to your preview from here, so I can't watch the page load. The plan makes the count independent of that weak spot, and adds a short log so the next load confirms where the 10 went.

## Is this the best approach?
It's the fastest safe fix, but the exact cause isn't confirmed yet. The stronger long-term option is to have the database itself do the counting: one place returns the Hires, Offers, Rejections and Avg time to hire numbers for a period. The page would no longer download thousands of records just to count them, so nothing could be cut off or dropped along the way. It also loads faster and stays correct as the workspace grows.

Recommended order: ship the fix below plus the log now, confirm 22 on your next load, then move the top cards to database-side counting as a follow-up.

## The fix
1. **Count hires (and offers and rejections) on their own.** Instead of pulling every candidate record and counting hires afterwards, the Hires, Offers, Rejections and Avg time to hire cards get a small dedicated lookup: "hired, with a hire date in this period, on these jobs". These are far fewer records, so nothing can get cut off.
2. **Stop silently dropping records.** The main data load only keeps candidates whose pipeline stage it can read. If it can't read the stage, the whole candidate vanishes, hires included. It will keep the candidate and label the stage "Unknown" instead, so the totals stay right.
3. **Add a one-line check to the page log.** Each load writes how many records came back, how many hires were found, and the earliest and latest hire date. After you reload once, I'll read it and confirm 22, or see exactly which step loses the older ones.
4. **Recheck the other cards the same way** for this period: offers 32, rejections 1,301, interviews 243, avg time to hire about 26 days.

## Technical details
- `useAnalyticsMetrics.ts`: change `job_hiring_stages!inner(... job_stages!inner(...))` to left embeds. Add `fetchAllIn` queries on `job_candidate_associations` filtered by status plus `hired_at`/`offered_at`/`rejected_at` within the period (`gte`/`lte`, with an `updated_at` fallback only where the event column is null). `totalHires`, `hiredInRange`, `totalOffers`, `rejectedCandidates` and the daily hires/offers/rejections trend are computed from those results.
- Use end-of-day for `dateRange.endDate` in the JS filters too (it currently compares against local midnight).
- `console.info('[Analytics] counts', { assocs, hired, hiredMin, hiredMax, start, end })`; remove it once confirmed.
- The same left-embed change applies anywhere else analytics uses an `!inner` stage join.
