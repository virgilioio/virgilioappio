

# Display AI Fit Score in Application Review + Sort by Score

## What changes

Show the AI fit score inline before each candidate's name in the Application Review tab as `[85%] Candidate Name`, and default-sort candidates by score (highest first). Users can toggle the sort.

## Files changed

| File | Change |
|------|--------|
| `src/hooks/usePipelineActions.ts` | Add `ai_fit_score` to `PipelineAssociation` interface and the `.select()` query |
| `src/pages/JobDetail.tsx` | When building `applicationReviewCandidates`, attach the `ai_fit_score` from the association to each candidate object. Sort by score descending by default. |
| `src/components/candidates/CandidateTable.tsx` | Add `showFitScore` prop. When enabled: (1) show a color-coded score badge before the candidate name in the Name column, (2) add a sortable "AI Fit" column header, (3) sort candidates by `ai_fit_score` descending by default |

## Technical details

### 1. `usePipelineActions.ts`
- Add `ai_fit_score?: number | null` to `PipelineAssociation`
- Add `ai_fit_score` to the `.select()` string on line 31

### 2. `JobDetail.tsx` (lines ~434-466)
- When filtering `applicationReviewIds`, also build a map of `candidateId → ai_fit_score` from associations
- When setting `applicationReviewCandidates`, attach `ai_fit_score` to each candidate object
- Sort by `ai_fit_score` descending (nulls last)

### 3. `CandidateTable.tsx`
- Add `showFitScore?: boolean` prop
- Add `ai_fit_score?: number | null` to `BaseCandidate` interface
- In the Name cell, when `showFitScore` is true and `ai_fit_score` exists, render a small color-coded badge before the name:
  - `≥75`: emerald/green
  - `≥50`: amber/yellow  
  - `<50`: red/orange
- Add local sort state: when `showFitScore` is true, default sort by `ai_fit_score` desc
- Add a clickable sort toggle on the "Name" column header (or a small "AI Fit" header) to let users re-sort

### 4. Pass `showFitScore={true}` in `JobDetail.tsx` for the application review `CandidateTable`

## Visual result

Each row in Application Review will show:
```
[85%] John Smith    [New]    Mar 27, 2026
[72%] Jane Doe               Mar 26, 2026
[—]   Bob Wilson   [New]    Mar 25, 2026
```

Candidates sorted highest score first by default. The score badge uses the same emerald/amber/red pastel pattern as other badges in the system.

