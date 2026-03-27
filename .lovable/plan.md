

# Revamp Suggested Candidates: AI Fit Scoring + Consistent UI

## Problem

1. **Bad matching quality**: The suggested candidates tab uses a heuristic keyword/skill matcher (`calculateEnhancedCandidateScore`) that produces inflated scores for irrelevant candidates. An accountant role gets random suggestions at 80%+ match.

2. **Inconsistent UI**: The suggested tab uses `showMatchScore` (a separate "Match" column with colored badges) while Application Review uses `showFitScore` (inline `[85%]` badge before the candidate name with emerald/amber/red colors). These should be unified.

## Solution

### 1. Replace heuristic scoring with AI Fit analysis

Instead of the current approach (score every candidate with keyword matching), the suggested tab will:

- **Edge function change** (`get-job-matching-candidates`): When called with a `job_id` (not sourcing project), run the real AI fit analysis for each candidate that passes a basic pre-filter. Store results in `job_candidate_associations` temporarily or return them inline.

**Simpler approach**: Rather than re-architecting the edge function, create a **new edge function** `get-suggested-candidates` that:
  1. Fetches the job's description, skills, and title
  2. Queries internal (local) candidates from the tenant, excluding already-associated ones
  3. Applies a lightweight pre-filter (skill overlap or title match) to narrow to ~50 candidates
  4. Calls the existing `analyze-candidate-fit` logic (or the OpenAI API directly) to score each pre-filtered candidate
  5. Returns only candidates scoring ≥50% with confidence, sorted by score descending
  6. Includes the AI fit score as `ai_fit_score` on each candidate so the frontend can use `showFitScore`

**Cost control**: The pre-filter limits AI calls to ~50 candidates max. Each call is lightweight (job description + candidate summary).

### 2. Update the frontend

**Hook**: Create `useJobSuggestedCandidates` (or modify `useJobMatchingCandidates`) to call the new edge function and return candidates with `ai_fit_score` attached.

**JobDetail.tsx**: Switch the suggested tab from:
```
showMatchScore={true}
```
to:
```
showFitScore={true}
```

This reuses the exact same inline badge pattern as Application Review — emerald ≥75%, amber ≥50%, red <50%.

Remove the separate "Match" column header and the `showMatchScore` prop usage for this tab.

### 3. Sort by AI fit score

Candidates in the suggested tab will be sorted by `ai_fit_score` descending (highest first), matching the Application Review behavior.

## Files changed

| File | Change |
|------|--------|
| `supabase/functions/get-suggested-candidates/index.ts` | **New** — AI-powered suggestion engine using real fit analysis |
| `src/hooks/useJobSuggestedCandidates.ts` | **New** — hook calling the new edge function |
| `src/pages/JobDetail.tsx` | Switch suggested tab to use new hook + `showFitScore` instead of `showMatchScore` |
| `src/hooks/useJobMatchingCandidatesCount.ts` | Update to use new endpoint for accurate count |

## Edge function design (`get-suggested-candidates`)

```text
Input:  { job_id, limit: 25 }
                    │
                    ▼
         ┌─────────────────┐
         │  Load job data   │  (title, description, skills, tenant_id)
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Pre-filter      │  Local candidates with ≥1 skill overlap
         │  candidates      │  or title match, exclude already associated
         │  (max ~100)      │  Filter by tenant_id
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  AI Fit scoring  │  Call OpenAI for each pre-filtered candidate
         │  (batch, ~50)    │  using job description + candidate profile
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Filter ≥50%     │  Return sorted by score desc
         │  Return top 25   │
         └─────────────────┘
```

## UI result

The suggested tab will look identical to Application Review:
```
[92%] Jane Doe        Senior Accountant at Deloitte
[78%] John Smith      Staff Accountant at KPMG
[—]   Bob Wilson      (scoring in progress)
```

Same emerald/amber/red badge colors, same inline placement, no separate Match column.

## Technical notes

- The new edge function reuses the same OpenAI prompt/logic from `analyze-candidate-fit` but doesn't persist results to `job_candidate_associations` (since these candidates aren't associated yet)
- Apollo candidates are excluded — only internal DB candidates appear
- The pre-filter ensures we don't waste AI calls on completely irrelevant candidates
- Existing `get-job-matching-candidates` remains untouched (used by sourcing projects)

