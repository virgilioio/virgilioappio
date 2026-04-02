

# Application Review Card for Dashboard

## Overview

A new dashboard card showing jobs that have candidates waiting in the Application Review stage, with per-job counts. Clicking a job row navigates to that job's application review tab. Empty state uses the Gio mascot pattern.

## Data fetching

**New hook: `src/hooks/useApplicationReviewCounts.ts`**

A React Query hook that fetches counts by querying:
```sql
job_candidate_associations (status = 'active')
  → joined with job_hiring_stages (current_stage_id)
  → joined with job_stages (stage_type = 'application_review')
  → grouped by job_id
```

Returns: `{ jobId, jobTitle, count }[]` — only jobs with count > 0.

Uses two queries:
1. Get all `job_hiring_stages` where `job_stages.stage_type = 'application_review'` for the user's accessible jobs.
2. Count `job_candidate_associations` grouped by job for those stage IDs.

Alternatively, a single query joining associations → hiring stages → job_stages filtering by stage_type, then grouping client-side. Stale time ~30s to match other dashboard hooks.

## New component: `src/components/dashboard/ApplicationReviewCard.tsx`

- Card with icon (`FileSearch` or `ClipboardList`) + title "Application Review"
- Each row: job title (truncated) + count badge (lilac/purple) + chevron
- Clicking a row → navigates to `/jobs/{jobId}?tab=application-review` (or opens in new tab, matching JobsOverview pattern)
- If no jobs have candidates in review → `GioEmptyState` with "No applications to review" message
- Loading state: skeleton rows matching TasksOverview pattern
- Max 5-6 jobs shown, with "View all" link if more

## Dashboard placement

**File: `src/pages/Dashboard.tsx`**

Add `<ApplicationReviewCard />` in the left column, between `OnboardingChecklist` and `JobsOverview`. Gate it behind `hasJobContent` like JobsOverview.

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useApplicationReviewCounts.ts` | New — React Query hook fetching per-job application review counts |
| `src/components/dashboard/ApplicationReviewCard.tsx` | New — compact card listing jobs with review candidates |
| `src/pages/Dashboard.tsx` | Add ApplicationReviewCard to left column |

