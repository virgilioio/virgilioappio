

# Add Application Details Tab to Scorecard Sheet

## Overview

Add a new "Application Details" tab alongside "Resume" and "Interview Details" in the scorecard sheet's left panel, so interviewers can review the candidate's application responses while filling out the scorecard.

## Changes

### File: `src/components/candidates/ScorecardSheet.tsx`

1. **Import** `CandidateApplicationResponses` component
2. **Add a new tab trigger** "Application" between "Resume" and "Interview Details" in the TabsList (line ~898)
3. **Add a new TabsContent** for the application tab that renders `CandidateApplicationResponses` with `candidateId` and `jobId` props (both already available as props on the scorecard sheet)
4. **Wrap in a scrollable container** since application responses can be long

The left panel already has `candidateId` and `jobId` available as props, and `CandidateApplicationResponses` handles its own data fetching, loading states, and empty states -- so this is a straightforward tab addition.

### Tab layout after change

| Tab | Status |
|-----|--------|
| Resume | Existing |
| Application | **New** |
| Interview Details | Existing (disabled, "Soon" badge) |

## Technical Details

### In `ScorecardSheet.tsx`

- Add import: `import { CandidateApplicationResponses } from '@/components/candidates/CandidateApplicationResponses'`
- Add `<TabsTrigger value="application">Application</TabsTrigger>` after the Resume trigger (line ~898)
- Add a `<TabsContent value="application">` block after the resume TabsContent (line ~919) that renders `CandidateApplicationResponses` inside a scrollable div, or shows a fallback if `candidateId` or `jobId` is missing

No other files need changes -- the `CandidateApplicationResponses` component is fully self-contained.

