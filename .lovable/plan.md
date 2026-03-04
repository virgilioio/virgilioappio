

# Fix: Save Offer Button Never Enables

## Root Cause

Both `CandidateProfileSheet.tsx` (line 1841) and `CandidateProfile.tsx` (line 619) pass `jobId={candidate.job_id || ''}` to the offer composer. However, `candidate` is fetched from the `candidates` table which does not have a `job_id` column — candidates are associated with jobs through the `job_candidates` junction table. So `candidate.job_id` is always `undefined`, the fallback produces `''`, and `canSave()` returns `false` because of the `!jobId` check.

Both components already receive the correct `jobId` as a prop from the URL/parent — they just aren't passing it to the composer.

## Fix

### 1. `CandidateProfileSheet.tsx` (line 1841)
Change `jobId={candidate.job_id || ''}` → `jobId={jobId}`
(uses the `jobId` prop already available on line 107)

### 2. `CandidateProfile.tsx` (line 619)
Change `jobId={candidate.job_id || ''}` → `jobId={jobId || ''}`
(uses the `jobId` from URL params, already resolved earlier in the component)

## Files changed
- `src/components/candidates/CandidateProfileSheet.tsx`
- `src/pages/CandidateProfile.tsx`

