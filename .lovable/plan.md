

# Two Issues: Profile Badge Standardization + Application Review Bug

## Issue 1: Candidate Profile Badges Are Plain

The `CandidateWorkExperience`, `CandidateEducationComponent`, and `CandidateCertifications` components all use generic `variant="secondary"` or `variant="outline"` badges instead of the standardized Smart Field variants. The `IndependentCandidateProfileSheet` Career Summary section also has a plain `variant="outline"` badge for the standardized title.

### Changes

**`src/components/candidates/CandidateWorkExperience.tsx`**
- Standardized title badge: `variant="outline"` → `variant="category"` with Sparkles icon
- Company industry badge: `variant="secondary"` → `variant="pastel-blue"` 
- Company size badge: `variant="outline"` → `variant="category"`
- Current badge: remove inline `bg-green-100 text-green-800` → `variant="status-active"`
- Skills badges: `variant="outline"` → `variant="pastel-purple"`

**`src/components/candidates/CandidateEducationComponent.tsx`**
- Education level badge: `variant="secondary"` → `variant="pastel-blue"`
- Grade badge: `variant="outline"` → `variant="category"`

**`src/components/candidates/CandidateCertifications.tsx`**
- Bootcamp badge: `variant="secondary"` → `variant="pastel-orange"`

**`src/components/candidates/IndependentCandidateProfileSheet.tsx`**
- Career Summary standardized title badge: `variant="outline"` → `variant="category"` with Sparkles icon

---

## Issue 2: Public Applicants Don't Appear in Application Review (Critical Bug)

**Root cause**: The `public-submit-application` edge function creates the `job_candidate_associations` record with `current_stage_id: null` (line 383). However, the Application Review system was formalized as a concrete stage (`stage_type = 'application_review'`). The `useApplicationReview` hook queries for `.eq('current_stage_id', arStageId)` — so candidates with `null` stage never match.

**Fix**: In `public-submit-application/index.ts`, before inserting the association, look up the `application_review` `job_hiring_stages` ID for that job and set it as `current_stage_id`.

### Changes

**`supabase/functions/public-submit-application/index.ts`** (~lines 367-384)
- Before the association insert, query:
  ```sql
  SELECT jhs.id FROM job_hiring_stages jhs
  JOIN job_stages js ON jhs.stage_id = js.id
  WHERE jhs.job_id = posting.job_id AND js.stage_type = 'application_review'
  LIMIT 1
  ```
- Use the returned ID as `current_stage_id` in the insert (fall back to `null` if not found for backward compat)
- Also set `entered_stage_at: new Date().toISOString()` for proper time tracking

### Files Summary

| File | Action |
|------|--------|
| `src/components/candidates/CandidateWorkExperience.tsx` | Update 5 badge variants to Smart Field style |
| `src/components/candidates/CandidateEducationComponent.tsx` | Update 2 badge variants |
| `src/components/candidates/CandidateCertifications.tsx` | Update 1 badge variant |
| `src/components/candidates/IndependentCandidateProfileSheet.tsx` | Update 1 badge variant |
| `supabase/functions/public-submit-application/index.ts` | Fix: look up application_review stage ID and set it on association insert |

