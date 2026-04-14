

# Move Favorite Heart to Name Header Row

## Problem
The heart icon is currently inside `CandidateNameCard` (the tab bar component). The user wants it next to the candidate name in the top header row, inline with the Independent Profile and LinkedIn buttons.

## Changes

### 1. `CandidateProfileSheet.tsx` — Add heart button to header row
- In the header (around line 1049-1053), add a Heart button between the name and the UserRound (Independent Profile) button
- Use the existing `isFavorite` / `handleToggleFavorite` state already in this component
- Remove `isFavorite` and `onToggleFavorite` props from the `CandidateNameCard` usage (lines 1252-1256)

Layout becomes:
```text
Name. [Heart] [UserRound] [LinkedIn]
```

### 2. `CandidateNameCard.tsx` — Remove favorite logic from this component
- Remove the `isFavorite` / `onToggleFavorite` props and the Heart rendering from CandidateNameCard
- This component goes back to being purely about tabs

### 3. `CandidateProfile.tsx` (full page) — Same pattern
- Add the heart button next to the candidate name in the page header
- Remove favorite props from CandidateNameCard usage there too

## Scope
- 3 files modified, no database or migration changes

