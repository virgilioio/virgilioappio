

# Pipeline Status Filter + Job Status Column on Candidates Page

## Overview
Two features: (1) add pipeline status filter to candidates page, (2) replace the simple "In Jobs" count column with a rich "Job Status" column showing job title, stage, stage status badges, and pipeline outcome.

## Data Fetching

### New hook: `useCandidateJobAssociations.ts`
Fetches all `job_candidate_associations` for the current candidate list with joined data:
- Query `job_candidate_associations` by candidate IDs (chunked, 200 per batch)
- For each association: `candidate_id, job_id, status, current_stage_id, entered_stage_at, booking_link_sent_at, rejected_at, offered_at, offered_by`
- Separately fetch `jobs` (id, title) for tenant
- Separately fetch `job_hiring_stages` + `job_stages` to resolve stage names (same pattern as talent intelligence)
- Returns a `Map<candidate_id, AssociationDetail[]>` where each detail has: job title, stage name, pipeline status, relevant dates

This replaces the simple `jobCounts` fetch currently in the table component (lines 178-200).

## Pipeline Status Filter

### CandidateFilterContext
Add `pipelineStatuses: string[]` to `CandidateFilters` and corresponding array filter key.

### CandidateFiltersPanel
Add a `FilterChipPopover` for "Pipeline" with options: active, rejected, hired, offer.

### useCandidateFilterOptions
Derive `pipelineStatusOptions` from the associations data (passed as new parameter).

### useCandidateFilteredData
When `pipelineStatuses` filter is active, only include candidates who have at least one association matching the selected statuses. Requires associations map as new parameter.

## Job Status Column

### New component: `CandidateJobStatusCell.tsx`
Renders the rich job status for a candidate row using the associations data.

**Layout for active candidates:**
```text
Account Executive
Hiring Manager Interview · Booking link sent
```

**Layout for rejected/hired/offer:**
```text
Account Executive
Hiring Manager Interview · Booking link sent
🔴 Rejected · Jan 2, 2026
```

**Multiple jobs:**
```text
Account Executive
Final Candidate Review · Pending schedule
In 2 other jobs
```

**Stage status badge logic** (derived from association columns):
- `booking_link_sent_at` is set → "Booking link sent"
- `entered_stage_at` is set but no booking link → "Pending schedule"  
- Neither → "New in stage"

**Pipeline status badges:**
- `rejected` → red badge with `rejected_at` date
- `offer` → blue badge with `offered_at` date
- `hired` → green badge with date

### Table changes (`IndependentCandidateTable.tsx`)
- Remove `jobCounts` state + its useEffect
- Replace "In Jobs" column header with "Job Status"
- Render `CandidateJobStatusCell` in the cell, passing the candidate's associations from the map
- Same for mobile card view

## Files

| File | Change |
|------|--------|
| `src/hooks/useCandidateJobAssociations.ts` | **New** — fetch + join association data |
| `src/components/candidates/CandidateJobStatusCell.tsx` | **New** — rich job status cell component |
| `src/contexts/CandidateFilterContext.tsx` | Add `pipelineStatuses` filter key |
| `src/hooks/useCandidateFilterOptions.ts` | Accept associations, derive pipeline status options |
| `src/hooks/useCandidateFilteredData.ts` | Accept associations, apply pipeline filter |
| `src/components/candidates/CandidateFiltersPanel.tsx` | Add Pipeline filter chip |
| `src/components/candidates/IndependentCandidateTable.tsx` | Use new hook, replace "In Jobs" with Job Status column |

