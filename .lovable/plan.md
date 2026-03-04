

# Show AI Analysis Availability Without Pre-Filling Scores

## Current Behavior
When an AI transcript analysis completes, it creates a full draft scorecard with a pre-set rating and `is_ai_draft: true`. Because a scorecard record already exists, the "Submit Scorecard" button disappears from the candidate profile — the user only sees the scorecard as if it's already been submitted.

## Desired Behavior
1. The "Submit Scorecard" button remains visible when only an AI draft exists
2. The button shows an indicator: "AI Notes Analysis available"
3. When the user opens the scorecard, they see the lilac banner with the analysis but **no pre-set rating** — the rating defaults to neutral
4. The user reviews the analysis, optionally clicks "Apply Suggestion", and **then** sets their own score and submits

## Changes

### 1. Edge function: `generate-scorecard-from-transcript/index.ts`
- **Stop pre-setting the rating** on the scorecard insert. Change `rating: suggestedRating` → `rating: 'yes'` (the DB default/neutral value). The AI's recommendation stays in `ai_suggested_rating` only, shown in the banner but not applied.

### 2. `CandidateProfileSheet.tsx` — Show button when AI draft exists
- Change the "Submit Scorecard" button condition from `!myScorecardsByStage[opt.jhsId]` to also show when the scorecard is an AI draft (`is_ai_draft === true`)
- When an AI draft exists, change the button label to show a Sparkles icon + "AI Notes Analysis Available" instead of "Submit Scorecard"
- Clicking it opens the scorecard sheet the same way (passing the existing AI draft scorecard)

### 3. `ScorecardSheet.tsx` — Don't use AI draft's rating as the starting rating
- In the initialization effect, when `existing?.is_ai_draft` is true, set the rating to `"yes"` (default neutral) instead of using `existing.rating` — so the interviewer starts fresh
- The `ai_suggested_rating` stays in the banner for reference; the user applies it explicitly via "Apply Suggestion"

### 4. `useScorecards.ts` — Expose `is_ai_draft` in `byStage` map
- The `byStage` map already stores the full `ScorecardRow` which includes `is_ai_draft`, so no changes needed to the hook itself — the parent component just needs to check `myScorecardsByStage[jhsId]?.is_ai_draft`

