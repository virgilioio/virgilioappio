

# Filter AI Drafts from Scorecard Display in Stage View

## Problem
When an AI-generated draft scorecard exists, the `ExpandableScoreDisplay` component renders it as a completed evaluation showing a "Yes" rating badge. This contradicts the product philosophy: the AI provides information, it does not decide. Users seeing a rating badge may perceive a decision has already been made.

## Changes

### 1. `src/components/candidates/ExpandableScoreDisplay.tsx`
Filter out AI draft scorecards from the normal scorecard list. AI drafts should **not** appear as scored evaluations. Instead, if there are AI drafts present, show a subtle "AI Analysis Available" indicator (Sparkles icon, muted style) that is clearly distinct from a human-submitted scorecard.

- Filter: `scorecards.filter(s => !s.is_ai_draft)` for the main scored list
- If any `is_ai_draft` scorecards exist, render a separate small indicator (e.g., a line with Sparkles icon and "AI Notes Analysis Available" text) — clicking it calls `onOpenFullSheet`
- The "No scorecards submitted" message should still show when only AI drafts exist (no human submissions)

### 2. `src/hooks/useAllStageScorecards.ts`
No changes needed — the hook should continue fetching AI drafts so the component can detect them and show the indicator.

### Result
- Human-submitted scorecards: shown as today with rating badge and feedback
- AI draft scorecards: shown only as a subtle "AI Analysis Available" indicator, no rating badge, no "Yes"/"No" display
- The "Submit Scorecard" / "AI Notes Analysis Available" button below (in `CandidateProfileSheet`) continues working as before

