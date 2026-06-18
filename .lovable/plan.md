## What's wrong today

In `ScorecardsSidebar` (Candidate Profile → Scorecards tab, right column):

- **Summary card** is hardcoded to `average={null}` and `panelistCount={Object.keys(myScorecardsByStage).length}` (only the current user's scorecards). It never computes a real score.
- **Verdict distribution** is a hardcoded zeroed array with the wrong labels (includes "Lean yes", omits "Definitely no"). The actual rating enum has only four values: `strong_yes`, `yes`, `no`, `definitely_no`.

## Plan

### 1. New hook: aggregate submitted scorecards for the association

Add `src/hooks/useAssociationScorecardSummary.ts`:

- Inputs: `associationId`, and the same `refreshKey` already used by `useAllStageScorecards` so it refreshes after save/delete (re-uses existing `scorecardsRefreshNonce`).
- Query `job_stage_scorecards` filtered by `association_id`, excluding AI drafts (`is_ai_draft = false` or null) and excluding rows with `rating is null` (those are unsubmitted).
- Apply the same visibility rule already used in `useAllStageScorecards`: admin/recruiter/owner see all; others see only their own. Visibility template is per-stage so we use a conservative aggregate — if the viewer isn't admin/recruiter, restrict to `created_by = user.id` (matches the per-stage behavior for the common "private" case).
- Compute:
  - `counts`: `{ strong_yes, yes, no, definitely_no }`
  - `filledCount`: sum of the four counts
  - `panelistCount`: distinct `created_by` among submitted rows
  - `average`: `(4*strong_yes + 3*yes + 2*no + 1*definitely_no) / filledCount`, rounded to one decimal. Null when `filledCount === 0`.

### 2. Update `ScorecardsSidebar` (`src/components/candidates/profile/tabs/SidebarRouter.tsx`)

- Change the Summary block to display `average / 4` instead of `/5` (rating scale is four options).
- Keep the 5-star row but render 4 stars instead of 5 (mapped from the 4-point scale, `Math.round(average)` filled).
- Keep `panelistCount` and "Across N panelist(s)" copy.

### 3. Wire real data in `CandidateProfileSheet.tsx`

Replace the hardcoded `ScorecardsSidebar` props (around line 1769–1782) with values from `useAssociationScorecardSummary(associationId, scorecardsRefreshNonce)`:

```ts
verdictBreakdown=[
  { label: 'Strong Yes',    tone: 'green',   count: counts.strong_yes },
  { label: 'Yes',           tone: 'green',   count: counts.yes },
  { label: 'No',            tone: 'red',     count: counts.no },
  { label: 'Definitely No', tone: 'red',     count: counts.definitely_no },
]
average={average}
panelistCount={panelistCount}
```

`pending` stays `[]` (out of scope for this request).

### 4. Verify

- Open the candidate profile → Scorecards tab. The Summary card shows a real `X.X/4` average with the matching star count and the correct panelist count.
- Verdict distribution shows exactly four rows in this order: **Strong Yes, Yes, No, Definitely No**, with correct counts and proportional bars.
- Submitting or deleting a scorecard updates the sidebar (because the hook listens to `scorecardsRefreshNonce` which is already bumped on save/delete/dismiss in `CandidateProfileSheet.tsx`).

## Out of scope

- No changes to the scorecard sheet, per-stage cards, or DB schema.
- No changes to the Job Overview tab scorecards card.