

# Fix: Cannot Re-open Scorecard After Saving

## Root Cause

After saving a scorecard, the "Submit Scorecard" button disappears (line 1083 condition: `!myScorecardsByStage[opt.jhsId] || myScorecardsByStage[opt.jhsId]?.is_ai_draft`). Once the scorecard exists and is no longer an AI draft, there's **no button to re-open it**.

The only way to view it is through the `ExpandableScoreDisplay` component's "Read more →" link, which requires expanding a collapsible first and only appears if `hasFeedback` is truthy. This is buried and non-obvious.

## Fix

**File: `src/components/candidates/CandidateProfileSheet.tsx` (~line 1083-1106)**

Add an `else` branch: when the user already has a saved (non-AI-draft) scorecard for that stage, show a **"View Scorecard"** button that opens the scorecard sheet with their existing submission:

```tsx
{(!myScorecardsByStage[opt.jhsId] || myScorecardsByStage[opt.jhsId]?.is_ai_draft) ? (
  <Button ...> Submit Scorecard / AI Notes </Button>
) : (
  <Button
    variant="outline"
    size="sm"
    onClick={() => {
      setScoreStageInstId(opt.jhsId)
      setScoreStageName(opt.stage.stage_name)
      setScoreOpen(true)
    }}
    className="gap-2"
  >
    <Star className="h-4 w-4" />
    View Scorecard
  </Button>
)}
```

This ensures users can always re-open their saved scorecard from the stage accordion. No other files need changes -- the `ScorecardSheet` already handles displaying an existing scorecard in read-only/edit mode via the `existing` prop.
