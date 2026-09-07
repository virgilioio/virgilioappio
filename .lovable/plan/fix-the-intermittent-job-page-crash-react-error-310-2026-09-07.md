# Fix the intermittent job page crash (React error #310)

## What's happening

On the job detail page, two `useMemo` hooks sit *below* the page's early exit branches (error state, loading skeleton, "no job yet" skeleton) in `src/pages/JobDetail.tsx`:

- line 937 `if (error) return ...`
- line 960 `if (jobLoading) return ...`
- line 974 `if (!job) return ...`
- line 999 `const screeningStageId = useMemo(...)`
- line 1016 `const sectionHandlers = useMemo(...)`

While the job is loading, the page renders with 2 fewer hooks than after it loads. React then throws "rendered fewer hooks than expected" (minified as #310) and the error boundary swallows the whole page. That's why it only happens sometimes — it depends on whether the job data resolves before or after that render.

## Fix — `src/pages/JobDetail.tsx` only

1. Move the derived `sectionCandidateList` / `sectionProfileContext` values and the two hooks (`screeningStageId`, `sectionHandlers`) plus the `advanceToScreening` helper **above** the three early returns, next to the other `useMemo` blocks around lines 469-495.
2. Keep the logic, dependency arrays and behaviour identical — this is purely a reordering so hook count is stable on every render. `advanceToScreening` stays a plain async function, just declared before the returns.
3. Guard nothing new: the early-return branches don't read those values, so hoisting is safe. `stageMap` and `associations` already default to empty during load.

## Verify

- Typecheck and build pass.
- Load a job page with a cold cache and hard-reload repeatedly; the page renders the skeleton then the content with no error boundary.
- Switch between Application review / Job offers / Hired / Rejected sections to confirm row actions (open, advance, reject, bulk email) still work.

No changes to data fetching, permissions, or any other file.
