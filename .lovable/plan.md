
# Validation Points Across the Interview Process

## The Idea

Surface the AI-generated "Points to Validate" directly inside the scorecard so interviewers know what to probe. Critically, validation points persist across stages -- marking something as "validated" in one interview doesn't make it disappear; instead, it builds a visible trail showing which concerns were addressed, when, and by whom.

## How It Works

When an interviewer opens a scorecard, they see a collapsible "Points to Validate" panel at the top of the form. Each point shows:
- The question/concern from the AI insights
- Its priority (high/medium/low)
- Its suggested stage
- Current status: open, validated, or flagged
- If already addressed: who addressed it and in which stage

Interviewers can mark points as "validated" or "flagged" directly from the scorecard. This status is stored in a new database table and carries forward across all stages -- so the next interviewer sees what's already been covered and what still needs attention.

## Database

A new table `validation_point_resolutions` tracks the status of each validation point across the process:

```text
validation_point_resolutions
+--------------------+-------------------------------------------+
| column             | type                                      |
+--------------------+-------------------------------------------+
| id                 | uuid (PK)                                 |
| association_id     | uuid (FK to job_candidate_associations)   |
| point_index        | integer (position in validation_points[]) |
| point_question     | text (snapshot of the question)            |
| status             | text ('validated' | 'flagged')             |
| resolved_by        | uuid (FK to auth.users)                   |
| resolved_at        | timestamptz                                |
| resolved_in_stage  | text (stage name where resolved)           |
| notes              | text (optional interviewer note)           |
| scorecard_id       | uuid (FK to job_stage_scorecards, nullable)|
+--------------------+-------------------------------------------+
```

RLS: Same hierarchy check as scorecards -- org members can read, authenticated users can insert/update their own.

## Frontend Changes

### 1. New hook: `src/hooks/useValidationPointResolutions.ts`

Fetches resolutions for an association and provides `resolvePoint(pointIndex, status, notes)` mutation. Returns a map of `pointIndex -> resolution` for easy lookup.

### 2. New component: `src/components/candidates/ScorecardValidationPoints.tsx`

A collapsible panel that:
- Takes `jobId` and `associationId` as props
- Fetches the AI fit analysis validation points via `useCandidateFitInsights`
- Fetches existing resolutions via the new hook
- Filters to show points relevant to the current stage first, then others
- Each point has "Validated" / "Flagged" action buttons
- Already-resolved points show a muted style with who resolved them and in which stage
- Counts show progress: "3 of 5 points addressed"

### 3. Update: `src/components/candidates/ScorecardSheet.tsx`

- Add `candidateId` prop (passed from parent -- it's already available in `CandidateProfileSheet`)
- Render `ScorecardValidationPoints` at the top of the right panel, above the rating section
- Pass current `stageName` so the component can highlight stage-relevant points

### 4. Update: `src/components/candidates/CandidateProfileSheet.tsx`

- Pass `candidateId` to `ScorecardSheet` (already available in scope)

## Key Design Decision: Cross-Stage Persistence

The validation points are NOT reset when a new scorecard is submitted or when the AI re-generates insights. Instead:

- Resolutions are tied to the `association_id` (candidate+job pair), not to a specific stage
- When the AI regenerates insights, existing resolutions remain (matched by `point_index` + `point_question` for safety)
- Each stage's interviewer sees the cumulative picture: what's been validated, what's flagged, and what's still open
- This creates an audit trail of due diligence across the entire hiring process

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/...` | Create `validation_point_resolutions` table with RLS |
| `src/hooks/useValidationPointResolutions.ts` | New hook for CRUD on resolutions |
| `src/components/candidates/ScorecardValidationPoints.tsx` | New panel component |
| `src/components/candidates/ScorecardSheet.tsx` | Add candidateId prop, render validation panel |
| `src/components/candidates/CandidateProfileSheet.tsx` | Pass candidateId to ScorecardSheet |
