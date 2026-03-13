

# Fix Application Review Query Syntax

## Problem
Two queries in `useApplicationReview.ts` use incorrect PostgREST filter syntax: `stage:job_stages.stage_type`. The colon alias syntax only works in `.select()`, not in `.eq()` / `.neq()` filters. PostgREST interprets `stage:` as a column name on `job_hiring_stages`, causing the 400 error.

## Fix
In `src/hooks/useApplicationReview.ts`, change two filter calls:

**Line 84** — finding the application_review stage:
```
.eq('stage:job_stages.stage_type', 'application_review' as any)
```
Change to:
```
.eq('job_stages.stage_type', 'application_review' as any)
```

**Line 152** — finding the first non-application_review stage:
```
.neq('stage:job_stages.stage_type', 'application_review' as any)
```
Change to:
```
.neq('job_stages.stage_type', 'application_review' as any)
```

Same fix needed anywhere else this pattern was used (check `PipelineOverview.tsx`, `JobDetail.tsx`).

## Scope
- `src/hooks/useApplicationReview.ts` — lines 84 and 152
- Audit other files for the same `stage:job_stages.` filter pattern

