

# Scorecard Visibility (Private/Public) Feature

## Current State

The `stage_scorecard_templates` table has no visibility column. All scorecards are implicitly visible to anyone with RLS access to the job (admin/recruiter via `check_org_hierarchy_role_access`). The `useAllStageScorecards` hook fetches all scorecards for a stage+association without any visibility filtering.

The scorecard reading flow:
- `useAllStageScorecards.ts` — fetches all scorecards for a candidate at a stage (used to show other interviewers' evaluations)
- `useScorecards.ts` — fetches/creates the current user's own scorecard
- `ScorecardSheet.tsx` — renders the scorecard form + displays other scorecards
- RLS on `job_stage_scorecards` — controls who can read/write scorecards at the DB level

## What Needs to Happen

The visibility setting belongs on the **template** (per-stage config), not on individual scorecards. When a recruiter sets a stage's scorecard to "Private", all scorecards submitted for that stage are hidden from other interviewers — only the scorecard author and admins/recruiters can see them. When "Public", anyone assigned to the job can see all scorecards.

### 1. Database Migration

Add `visibility` column to `stage_scorecard_templates`:

```sql
ALTER TABLE public.stage_scorecard_templates
ADD COLUMN visibility text NOT NULL DEFAULT 'private'
CHECK (visibility IN ('private', 'public'));
```

No RLS changes needed on `job_stage_scorecards` itself — visibility filtering will be done at the application layer when fetching "other people's" scorecards. The template visibility is a configuration setting, not a security boundary (admins/recruiters always see all).

### 2. Hook: `useScorecardsConfiguration.ts`

- Add `visibility` to the `ScorecardTemplate` interface
- Read it from the template query
- Add an `updateVisibility` mutation that updates `stage_scorecard_templates.visibility`

### 3. UI: `ScorecardsTab.tsx`

Add a visibility toggle at the top of the scorecards configuration panel (above the questions list):

```
┌─────────────────────────────────────────┐
│ Scorecard Visibility                    │
│                                         │
│ [Private ●───○ Public]                  │
│                                         │
│ Private: Only the interviewer who       │
│ submitted and admins/recruiters can     │
│ view scorecard responses.               │
│                                         │
│ Public: All team members with access    │
│ to this job can view scorecard          │
│ responses and recommendations.          │
└─────────────────────────────────────────┘
```

Uses the existing `Switch` component with a label. Saves immediately on toggle (no save button needed).

### 4. Reading Side: `useAllStageScorecards.ts`

When fetching scorecards for a stage, also fetch the template's `visibility` setting. If `visibility = 'private'`:
- Filter out scorecards where `created_by !== currentUser.id` — **unless** the current user is an admin/recruiter (they always see all)
- This requires knowing the user's role, which is available from `useAuth` context

The hook will:
1. Fetch the template visibility via a join or separate query
2. Apply client-side filtering based on visibility + user role
3. Expose `isPrivate` so the UI can show appropriate messaging

### 5. UI Indication on ScorecardSheet

When viewing a stage with private scorecards, show a small info badge: "Scorecards for this stage are private — only you and recruiting staff can see your evaluation."

## Files to Change

| File | Change |
|---|---|
| DB migration | Add `visibility` column to `stage_scorecard_templates` |
| `src/hooks/useScorecardsConfiguration.ts` | Add visibility to template type + updateVisibility mutation |
| `src/components/jobs/stage-config/ScorecardsTab.tsx` | Add visibility toggle UI |
| `src/hooks/useAllStageScorecards.ts` | Fetch template visibility, filter scorecards accordingly |
| `src/components/candidates/ScorecardSheet.tsx` | Show privacy indicator badge |

