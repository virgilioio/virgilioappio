

# Fix Salary Question Not Displaying Saved Value in Scorecards

## Problem

When a user submits a scorecard with a salary field filled out, then re-opens the scorecard, the salary field appears empty -- even though the data IS saved correctly in the database.

The salary data is also correctly synced to the candidate profile and does trigger AI Insights re-evaluation. The issue is purely a display/state bug on re-open.

## Root Cause

There is a race condition between three effects in `ScorecardSheet.tsx`:

1. **Initialization effect** (line 207): Runs on `open` -- checks for a localStorage draft and restores it, or sets defaults. Does NOT reset `responses` when no draft exists.
2. **Load questions effect** (line 357): Runs on `open` -- starts an async DB fetch for questions AND responses. On completion, calls `setResponses(responsesMap)` with the correct salary data.
3. **Auto-save draft effect** (line 266): Runs whenever `responses` changes -- saves current state to localStorage after a 1-second debounce.

The race:
- On mount, `responses` starts as `{}` (empty object)
- The auto-save effect sees `responses = {}` and saves an empty draft to localStorage
- The async load completes and sets the correct responses from DB
- But if `existing` prop updates (e.g., `viewingScorecardId` resets), the init effect re-runs, finds the recently-saved empty draft, sees its timestamp is newer than the DB record, and restores `responses = {}` -- wiping the loaded data

## Fix (in `src/components/candidates/ScorecardSheet.tsx`)

### 1. Skip auto-save while questions are loading

Add `loadingQuestions` to the auto-save draft effect's guard clause. If questions are still loading, the responses are not yet meaningful and should not be persisted:

```typescript
// Line ~268
if (!open || isReadOnly || loadingQuestions) return;
```

### 2. Clear stale draft after DB responses are loaded

After successfully loading responses from the database in `loadQuestionsAndResponses`, clear any existing draft to prevent the init effect from restoring stale/empty data on subsequent re-runs:

```typescript
// After setResponses(responsesMap) at line ~408
clearDraft();
setHasDraft(false);
```

This ensures that once authoritative DB data is loaded, it won't be overwritten by a draft that was saved during the loading window.

## AI Insights Re-evaluation

Already working correctly:
- On scorecard save, the salary amount is synced to the `candidates` table (salary_amount, salary_currency, salary_period)
- `triggerFitAnalysis()` is called after save, which invokes the `analyze-candidate-fit` edge function
- The edge function reads the updated candidate profile including salary data

No changes needed for AI insights.

## Files Changed

| File | Change |
|------|--------|
| `src/components/candidates/ScorecardSheet.tsx` | Add `loadingQuestions` guard to auto-save effect; clear draft after DB responses load |

