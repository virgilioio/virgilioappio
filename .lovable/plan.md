

# Fix: Open Candidate Profile Sheet After Creation

## Root Cause

Three entry points fail to open the candidate profile after successful creation:

1. **Candidates.tsx** (line 99): Uses `window.open(..., '_blank')` which opens a **new browser tab** instead of opening the profile sheet in the current page.

2. **GlobalCreateButton.tsx** (line 108): When no job is assigned, navigates to `/candidates` **without** the `openCandidate` query param. When a job IS assigned, doesn't navigate to the job page to show the candidate either.

3. **JobDetail.tsx** (line 668-669): Closes the form and refreshes the pipeline, but never opens the candidate profile sheet. Should set the URL `?candidate=` param to trigger the sheet.

## Fix

### 1. `src/pages/Candidates.tsx`
Replace `window.open('/candidates?openCandidate=...', '_blank')` with in-page navigation using `useSearchParams`. After creation, set `openCandidate` query param on the current page so `IndependentCandidateTable`'s existing `useEffect` picks it up and opens the sheet.

### 2. `src/components/layout/GlobalCreateButton.tsx`
- **No job assigned**: Navigate to `/candidates?openCandidate=${id}` instead of just `/candidates`
- **Job assigned**: Navigate to `/jobs/${jobId}?candidate=${id}` so the job page opens the candidate sheet

### 3. `src/pages/JobDetail.tsx`
After successful creation in `handleAddCandidate`, update the URL with `?candidate=${result.id}` using `setSearchParams` or `navigate` so the existing candidate sheet logic opens the profile.

## Files

| File | Change |
|------|--------|
| `src/pages/Candidates.tsx` | Replace `window.open` with in-page `searchParams.set('openCandidate', id)` |
| `src/components/layout/GlobalCreateButton.tsx` | Add `openCandidate` param to navigation; add job-context navigation |
| `src/pages/JobDetail.tsx` | After creation, set `?candidate=` URL param to open the profile sheet |

## What stays untouched
- `IndependentCandidateTable.tsx` — already handles `openCandidate` query param
- `CandidateFormSheet.tsx` — no changes
- All hooks, Supabase queries, permissions

