
# Fix: Background Enrichment Not Triggering for Existing Candidates

## Root Cause

There are two code paths for resume uploads, but only one triggers AI enrichment:

1. **New candidate creation** (CandidateFormSheet, create mode): Resume text is captured, and after saving, `triggerBackgroundEnrichment` fires. This works.

2. **Existing candidate edit** (CandidateFormSheet, edit mode + EnhancedResumeDropzone): The resume is parsed via `parseAndUpdateCandidate`, which updates contact fields but **never calls `triggerBackgroundEnrichment`**. Additionally, the `onResumeTextCaptured` callback is blocked by an `if (!candidate)` guard, so the resume text is never even captured in edit mode.

Result: Any candidate who was created first and got a resume uploaded later never gets an AI profile summary or skills generated.

## Fix

Add `triggerBackgroundEnrichment` to the `parseAndUpdateCandidate` function in `src/hooks/useResumeParsing.ts`. This is the cleanest single fix because this function already has access to both the `candidateId` and the extracted `textContent`, and it's the code path used for all existing-candidate resume uploads.

### Changes

**File: `src/hooks/useResumeParsing.ts`**

- Import `triggerBackgroundEnrichment` from `useCandidateEnrichment`
- At the end of `parseAndUpdateCandidate` (after updating candidate fields), call `triggerBackgroundEnrichment(candidateId, textContent, parsed.name)` to queue background AI generation of profile summary and skills
- Only trigger if the candidate doesn't already have a complete profile summary (check from the fetched `existing` record to avoid overwriting good data)

### Technical Detail

```text
parseAndUpdateCandidate(file, candidateId)
  1. Extract text from file           (already exists)
  2. Call parse-resume edge function   (already exists)
  3. Update missing contact fields     (already exists)
  4. NEW: triggerBackgroundEnrichment() (adds profile_summary + skills)
```

The enrichment function already handles the "only update if missing" logic on the server side for profile_summary, but to be safe we'll also gate the trigger on `!existing.profile_summary` or `existing.profile_summary.length < 50` (same logic already used for the inline update).

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/useResumeParsing.ts` | Import `triggerBackgroundEnrichment`, call it at end of `parseAndUpdateCandidate` when profile summary is missing/short |

One file, ~5 lines added.
