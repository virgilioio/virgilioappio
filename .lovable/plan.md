

# Replace AI Career Summary with Fit Insights + Pre-Generate on Application

## Two changes

### 1. Application Review Sheet: Replace "AI Career Summary" tab with "AI Insights"

**`src/components/candidates/ApplicationReviewSheet.tsx`**

- Rename tab from "AI Career Summary" to "AI Insights"
- Remove `ProfileSummaryMarkdown` usage in that tab
- Import `useCandidateFitInsights` and `FitScoreRadial`
- In the tab content, call `useCandidateFitInsights(candidateId, jobId)` and render:
  - `FitScoreRadial` (score + confidence badge)
  - Executive summary text below it
  - A "Generate" button if no analysis exists, with loading state
  - Auto-trigger analysis if none exists (same pattern as `CandidateInsightsTab`)

### 2. Pre-generate insights at application time

The simplest approach: trigger `analyze-candidate-fit` as fire-and-forget at the end of `public-submit-application` — the same edge function, called server-to-server. By the time a recruiter opens Application Review (usually minutes/hours later), insights are already cached.

**`supabase/functions/public-submit-application/index.ts`**

After the association is created and enrichment is triggered (around line 456), add a fire-and-forget call:

```ts
// Fire-and-forget: pre-generate AI fit insights
try {
  const fitUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-candidate-fit`
  fetch(fitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ candidate_id: globalCandidateId, job_id: posting.job_id }),
  }).catch(() => {}) // truly fire-and-forget
} catch {}
```

This runs after enrichment has been triggered, so the fit analysis will pick up whatever candidate data is available. If enrichment finishes first (likely, since it's also fire-and-forget), the fit analysis gets richer data. If not, the Insights tab's auto-trigger on open will refresh with updated data.

Also add the same fire-and-forget call in `useCandidateAssociations.ts` `addAssociation` (for manually added candidates), so any candidate-job pairing gets pre-analyzed.

## Files

| File | Change |
|------|--------|
| `src/components/candidates/ApplicationReviewSheet.tsx` | Replace AI Career Summary tab with Fit Insights (score radial + executive summary) |
| `supabase/functions/public-submit-application/index.ts` | Add fire-and-forget call to `analyze-candidate-fit` after association creation |
| `src/hooks/useCandidateAssociations.ts` | Add fire-and-forget `triggerFitAnalysis` after successful `addAssociation` |

