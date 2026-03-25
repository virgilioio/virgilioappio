

# Fix "Open in GoGio" URLs in Chrome Extension

## Problem

The edge functions (`chrome-api-gateway` and `chrome-api-candidates`) generate legacy candidate URLs:

```
/jobs/{jobId}/candidates/{candidateId}
```

This route (`/jobs/:jobId/candidates/:candidateId`) renders the old full-page `CandidateProfile` component. The current platform uses:

- **Job-associated**: `/jobs/{jobId}?candidate={candidateId}` — opens the profile sheet within the job pipeline
- **Independent (no job)**: `/candidates?openCandidate={candidateId}` — opens the profile sheet on the candidates page

## What to prompt the Chrome Helper Hub project

Here is the exact prompt you can send to the Chrome Helper Hub project:

---

**Update the "Open in GoGio" candidate URLs to use the current routing pattern.**

Currently, two edge functions in the **main ATS project** return `candidate_url` in the legacy format `/jobs/{jobId}/candidates/{candidateId}`. The correct URLs are now:

- **Job-associated candidates**: `/jobs/{jobId}?candidate={candidateId}`
- **Independent candidates (no job association)**: `/candidates?openCandidate={candidateId}`

### Changes needed in the ATS project (this project's edge functions)

**File: `supabase/functions/chrome-api-gateway/index.ts`**

Line ~460 and ~1007 — change:
```typescript
candidate_url: `/jobs/${assoc.job_id}/candidates/${candidateId}`
```
to:
```typescript
candidate_url: `/jobs/${assoc.job_id}?candidate=${candidateId}`
```

Line ~1016 — for independent candidates with no job associations, change the fallback:
```typescript
candidate_url: currentJobs.length > 0 ? currentJobs[0].candidate_url : `/candidates?openCandidate=${candidate.id}`
```

**File: `supabase/functions/chrome-api-candidates/index.ts`**

Line ~281 — same change:
```typescript
candidate_url: `/jobs/${assoc.job_id}?candidate=${candidateId}`
```

### No changes needed in the Chrome Helper Hub
The extension code in `CandidateForm.tsx` already uses the URL correctly — it just prepends `https://app.gogio.io` and opens in a new tab. The fix is entirely in the URL format returned by the edge functions.

After updating the edge functions, redeploy both `chrome-api-gateway` and `chrome-api-candidates`.

---

## Summary

This is actually a fix in **this project's** edge functions, not the Chrome Helper Hub. The extension code is fine — it just opens whatever URL the API returns. The two edge functions need their `candidate_url` format updated from the legacy `/jobs/{id}/candidates/{id}` path to the query-parameter pattern (`/jobs/{id}?candidate={id}` or `/candidates?openCandidate={id}`).

| File | Change |
|------|--------|
| `supabase/functions/chrome-api-gateway/index.ts` | Update 3 `candidate_url` assignments to use query params |
| `supabase/functions/chrome-api-candidates/index.ts` | Update 1 `candidate_url` assignment to use query params |
| Chrome Helper Hub — no changes needed | URLs are consumed as-is |

