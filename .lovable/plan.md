

# Add "Favorite" Candidate Feature (Job-Scoped)

## Summary
Add a heart icon next to the candidate name on job-associated candidate profiles to mark/unmark favorites. This is per-job (stored on `job_candidate_associations`). Also add filter chips to the job pipeline view, including a "Favorites" filter.

## Database Change
Add a `is_favorite` boolean column to `job_candidate_associations`, defaulting to `false`.

```sql
ALTER TABLE public.job_candidate_associations
  ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;
```

## Code Changes

### 1. Update `PipelineAssociation` interface and fetch query
**File**: `src/hooks/usePipelineActions.ts`
- Add `is_favorite: boolean` to the `PipelineAssociation` interface
- Add `is_favorite` to the select query in `fetchAssociationsForJob`

### 2. Add favorite toggle to `CandidateNameCard`
**File**: `src/components/candidates/CandidateNameCard.tsx`
- Add optional props: `isFavorite`, `onToggleFavorite`
- Render a Heart icon (filled red when favorite, outline when not) next to the candidate name
- Click toggles via `onToggleFavorite`

### 3. Wire favorite toggle in `CandidateProfile` page
**File**: `src/pages/CandidateProfile.tsx`
- Fetch the association's `is_favorite` status (from the existing association data or a small query)
- Pass `isFavorite` and `onToggleFavorite` to `CandidateNameCard`
- `onToggleFavorite` updates `job_candidate_associations.is_favorite` via supabase

### 4. Wire favorite toggle in `CandidateProfileSheet`
**File**: `src/components/candidates/CandidateProfileSheet.tsx`
- Same logic as above for the sheet-based candidate profile view

### 5. Show favorite indicator on `CandidateCard` (pipeline board)
**File**: `src/components/jobs/CandidateCard.tsx`
- Add `isFavorite` prop
- Show a small filled heart icon on favorite cards

### 6. Pass `isFavorite` through pipeline rendering
**File**: `src/components/jobs/PipelineOverview.tsx`
- Pass `isFavorite` from association data to `CandidateCard`

### 7. Add filter chips to PipelineOverview
**File**: `src/components/jobs/PipelineOverview.tsx`
- Add a filter bar above the board/list with `FilterChipPopover` components
- Filters: **Favorite** (Yes/No), **Stage**, **Source**, **AI Fit Score** range
- Filter the displayed associations client-side before rendering

### 8. Update `Candidate` interface
**File**: `src/hooks/useCandidates.ts`
- Add `is_favorite` to the `Candidate` interface and the fetch query

## Scope
- 1 migration (add column)
- ~7 files modified
- No edge function changes needed

