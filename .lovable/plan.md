

# Plan: Upgrade Public Job Application Form to Match Internal Candidate Creation Flow

## Overview

The public job application form (`src/pages/PublicJobPosting.tsx`) has fallen behind the internal candidate creation flow (`CandidateFormSheet.tsx`). This plan brings it to parity across 6 areas, ordered by priority.

---

## Change 1: Fix LinkedIn URL Auto-Fill from Resume Parsing

**Problem:** The `handleParsedFile` function (line 228-260) ignores `parsed.linkedinUrl` entirely. The internal flow sets it correctly.

**Fix:** In `handleParsedFile`, add LinkedIn URL assignment from parsed data:

```typescript
setCoreFieldValues(prev => ({
  ...prev,
  candidate_name: parsed.name || prev.candidate_name,
  email: parsed.email || prev.email,
  phone: parsed.phone || prev.phone,
  linkedin_url: parsed.linkedinUrl || prev.linkedin_url,  // <-- ADD THIS
  profile_summary: profileSummary
}))
```

**File:** `src/pages/PublicJobPosting.tsx` (line ~243)

---

## Change 2: Add Proper Email Format Validation

**Problem:** The public form only checks `if (!coreFieldValues.email.trim())` -- it never validates email format. The internal flow uses `react-hook-form` validation.

**Fix:** Add a regex-based email format validation in `handleSubmitApplication` (line ~351), after the emptiness check:

```typescript
// After checking email is not empty:
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (!emailRegex.test(coreFieldValues.email.trim())) {
  missingFields.push('Valid Email Address')
}
```

Also add real-time visual feedback on the email `Input` component using the `error` prop when the format is invalid.

**File:** `src/pages/PublicJobPosting.tsx`

---

## Change 3: Replace Inline Resume Dropzone with EnhancedResumeDropzone

**Problem:** Lines 634-711 contain a hand-coded dropzone that duplicates the `EnhancedResumeDropzone` component but without its features (two-stage parsing, file capture callbacks, proper loading states).

**Fix:** Replace the 77-line inline dropzone with `EnhancedResumeDropzone`, configured for the public form context:

```typescript
<EnhancedResumeDropzone
  onParsed={(parsed) => {
    // Apply parsed data to coreFieldValues (name, email, phone, linkedin, profile_summary)
  }}
  onSkillsGenerated={(skills) => { /* store generated skills */ }}
  isUploading={false}
  autoGenerateSkills={false}  // Skills handled by background enrichment
  showUpload={false}          // Don't upload yet -- edge function handles it
  parseOnly={true}            // Just parse the file
  useTwoStageAI={true}        // Fast core extraction
  onFileCaptured={(file) => setUploadedFiles([file])}
  onResumeTextCaptured={(text) => setCapturedResumeText(text)}
/>
```

This also requires:
- Adding a `capturedResumeText` state variable (for background enrichment)
- Removing the old inline dropzone JSX

**File:** `src/pages/PublicJobPosting.tsx`

---

## Change 4: Enable Two-Stage AI Parsing

**Problem:** The public form calls `parseResume(file)` (full single-pass parsing, slow ~8-10s). The internal flow uses `parseResumeCoreFields(file)` (fast ~3-5s) + background enrichment.

**Fix:** This is mostly handled by Change 3 above -- setting `useTwoStageAI={true}` on `EnhancedResumeDropzone` switches from `parseResume` to `parseResumeCoreFields` internally.

The `handleParsedFile` function can be simplified or removed since `EnhancedResumeDropzone`'s `onParsed` callback handles everything directly.

**File:** `src/pages/PublicJobPosting.tsx`

---

## Change 5: Trigger Server-Side AI Enrichment After Submission

**Problem:** After a public application is submitted, the candidate record never receives background AI enrichment (skills + profile summary). The internal flow calls `triggerBackgroundEnrichment()` after creation.

**Fix:** Add enrichment trigger in the `public-submit-application` edge function, after the candidate is created and files are uploaded:

```typescript
// After successful candidate creation + file upload, if we have resume text:
// Fire-and-forget call to enrich-candidate-profile
if (globalCandidateId) {
  // Extract resume text from the uploaded file (if base64 PDF)
  // OR accept resumeText from the frontend payload
  const enrichUrl = `${SUPABASE_URL}/functions/v1/enrich-candidate-profile`;
  fetch(enrichUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      candidateId: globalCandidateId,
      resumeText: body.resumeText || '',
      candidateName: candidateName,
    }),
  }).catch(err => console.error('Background enrichment call failed:', err));
}
```

Frontend changes:
- Pass `capturedResumeText` (from the two-stage parsing) in the application payload as `resumeText`
- Add `resumeText` to the `SubmitApplicationPayload` interface

**Files:**
- `src/pages/PublicJobPosting.tsx` -- add `resumeText` to submission payload
- `supabase/functions/public-submit-application/index.ts` -- add enrichment trigger

---

## Change 6: Remove Dead PublicApplicationForm.tsx

**Problem:** `src/components/forms/PublicApplicationForm.tsx` is an old, unused component (not referenced anywhere in routing or active code).

**Fix:** Delete the file entirely.

**File:** `src/components/forms/PublicApplicationForm.tsx` (DELETE)

---

## Summary of Files Modified

| File | Changes |
|------|---------|
| `src/pages/PublicJobPosting.tsx` | LinkedIn auto-fill, email validation, replace inline dropzone with `EnhancedResumeDropzone`, add `capturedResumeText` state, pass `resumeText` in submission payload, remove unused imports |
| `supabase/functions/public-submit-application/index.ts` | Accept `resumeText` field, trigger background enrichment after candidate creation |
| `src/components/forms/PublicApplicationForm.tsx` | DELETE (dead code) |

## Risk Assessment

- **Low risk**: Changes 1, 2, 6 are isolated fixes with no side effects
- **Medium risk**: Changes 3-4 replace the dropzone UI -- needs testing to verify file capture, parsing animation, and state flow work correctly in the public (unauthenticated) context
- **Low risk**: Change 5 is fire-and-forget; if enrichment fails, the application still succeeds

