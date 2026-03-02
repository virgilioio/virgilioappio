
# Fix Notification Click — Open Candidate Sheet Instead of Old Profile Page

## Problem

Clicking a notification navigates to `/candidates/:candidateId`, which renders the legacy `IndependentCandidateProfile` page (the old full-page layout shown in your screenshot). The correct behavior should open the candidate profile **sheet** (sidebar), matching what happens when you click a row in the Candidates table.

## Solution

Two changes:

### 1. `NotificationCenter.tsx` — Change navigation target

Instead of `navigate(`/candidates/${candidateId}`)`, navigate to `/candidates?openCandidate=${candidateId}`. This takes the user to the Candidates page with a query param indicating which candidate sheet to open.

### 2. `IndependentCandidateTable.tsx` — Read query param and auto-open sheet

On mount (and when the URL changes), read the `openCandidate` search param. If present, set `selectedCandidateId` and `sheetOpen` to true, then clear the param from the URL (so refreshing doesn't re-open it).

This keeps the sheet logic where it already lives (inside the table component) and requires no prop drilling through the Candidates page.

## Technical Details

### `src/components/layout/NotificationCenter.tsx`

- Change `navigate(`/candidates/${notification.candidateId}`)` to `navigate(`/candidates?openCandidate=${notification.candidateId}`)`

### `src/components/candidates/IndependentCandidateTable.tsx`

- Import `useSearchParams` from `react-router-dom`
- Add a `useEffect` that checks for `openCandidate` param
- If found, call `setSelectedCandidateId(id)` and `setSheetOpen(true)`, then remove the param from the URL

### Files changed

| File | Change |
|------|--------|
| `src/components/layout/NotificationCenter.tsx` | Update navigation URL |
| `src/components/candidates/IndependentCandidateTable.tsx` | Read `openCandidate` query param and auto-open sheet |
