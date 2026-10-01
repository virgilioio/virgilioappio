# Fix analytics undercounting (Hires and every other widget)

## What's wrong (confirmed)
Your workspace has **22 hires** between Apr 1, 2025 and Oct 1, 2026, but the Hires card shows 12.

The cause: the database hands back at most 1,000 rows per request. Analytics loads every candidate-on-a-job record in one request, and your workspace has **1,450** of them. About a third are silently cut off before anything is counted. The cut is arbitrary, so it doesn't fall evenly on old or new records.

This isn't limited to Hires. Every widget built from the same records undercounts in large workspaces:
- Applications, Active candidates, Hires, Avg time to hire, Offers, Rejections and Stage distribution.
- Job health, Recruiter, Source, Talent, Stage performance and Offer analytics.
- Interviews per hire, plus the new Pipeline hygiene widgets once the list passes 1,000.

Interview counts (522 records today) are fine for now, but would break the same way later.

## The fix
1. **Load everything, in pages.** A shared loader fetches records 1,000 at a time until none are left, and splits long job lists into smaller groups so requests never get too large. Every analytics data source switches to it, interviews included.
2. **Recheck every widget against the database.** For your workspace and this period I'll compare each top-line number with a direct database count: hires 22 and its average time to hire, applications, active, offers, rejections, interviews scheduled, interviews per hire and stuck candidates. I'll report the expected values so you can match them on screen.
3. **Guard against regressions.** Add a small automated test that checks the loader returns more than 1,000 rows across pages.

## Technical details
- New `src/lib/fetchAllRows.ts`: `fetchAll(buildQuery)` loops `.range(from, from+999)` with a stable `.order('id')` until a short page; `inChunks(ids, 150, fn)` merges results.
- Replace the single-shot selects in `useAnalyticsMetrics.ts` (associations, extra associations, both booking queries), `useJobHealthMetrics`, `useStagePerformanceMetrics`, `useRecruiterPerformanceMetrics`, `useSourcePerformanceMetrics`, `useTalentInsightsMetrics`, `useOfferAnalyticsMetrics`, `useInterviewHealthMetrics`, `useInterviewsPerHireMetrics`, and the `chunked` helper in `usePipelineAgingMetrics` (it chunks job ids but doesn't paginate).
- Record an AGENTS.md rule: analytics reads must go through the paginated loader.
