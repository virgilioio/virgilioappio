

# Hide Pipeline Sub-Tabs for Restricted Viewers (HM/Interviewer)

## What Changes

For hiring managers and interviewers (`isRestrictedViewer === true`), hide the entire pipeline sub-tab card (the 6-tab bar with Suggested, Application Review, Recruiting Process, Offers, Hired, Rejected) and lock them directly into the "recruiting" view — the actual Kanban/pipeline board.

They already default to `pipelineSectionTab = 'recruiting'`, so we just need to hide the tab selector UI.

## File: `src/pages/JobDetail.tsx`

### 1. Force `pipelineSectionTab` to 'recruiting' for restricted viewers
Add a `useEffect` that resets `pipelineSectionTab` to `'recruiting'` if the user is a restricted viewer and somehow ends up on a different sub-tab.

### 2. Hide the sub-tab Card on desktop (lines ~1345-1389)
Wrap the `<Card className="mb-4">` that contains the pipeline sub-tabs `TabsList` with `{!isRestrictedViewer && (...)}` so restricted viewers skip straight to the pipeline board.

### 3. Hide the sub-tab Card/dropdown on mobile (lines ~917-987)
Same treatment for the mobile pipeline section — wrap the `<Card className="mb-4">` containing the mobile dropdown selector with `{!isRestrictedViewer && (...)}`.

### 4. Hide non-recruiting action buttons for restricted viewers
The action bar in the pipeline header (Add Candidate, Select, bulk actions) already shows contextually based on `pipelineSectionTab`. Since restricted viewers are locked to 'recruiting', the correct buttons will show automatically. No extra changes needed there.

## Result
- HM/Interviewer lands on Pipeline tab and sees only the Kanban board directly — no sub-tab navigation
- Recruiters and admins continue to see all 6 sub-tabs as before

