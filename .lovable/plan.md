

# Replace "Enrich from LinkedIn" with "AI Enrich" Button

## Summary
Replace the Apollo/LinkedIn enrichment button with one that triggers the existing `enrich-candidate-profile` edge function (individual AI enrichment from resume data).

## Changes

**File**: `src/components/candidates/IndependentCandidateProfileSheet.tsx`

1. **Remove** the `useEnrichCandidate` import and its usage (`enrichByLinkedIn`, `canEnrich`, `isEnriching`)
2. **Import** `triggerBackgroundEnrichment` from `@/hooks/useCandidateEnrichment`
3. **Replace `handleEnrichFromLinkedIn`** with a new `handleAIEnrich` function that:
   - Calls `triggerBackgroundEnrichment(candidateId, resumeText, candidateName)`
   - Gets resume text from the candidate's `resume_url` or existing attachments
   - Shows a toast confirming enrichment was triggered
   - Adds local loading state for the button
4. **Replace the button** (lines 268-283): Change label to "AI Enrich", keep `Sparkles` icon, wire to `handleAIEnrich`
5. **Update visibility condition**: Show the button when the candidate exists and has a resume (instead of checking `canEnrich` which checks LinkedIn URL + Apollo status). Also show it if enrichment_status is not already 'processing'.

The existing `triggerBackgroundEnrichment` function already handles fire-and-forget invocation of the edge function. The button will be available whenever a candidate has resume content to parse.

