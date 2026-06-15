
## Audit: is resume parsing working?

I traced every place that uses `parse-resume` / resume extraction. Three workflows, three different outcomes.

### 1. Manual "Create candidate" / drag-and-drop resume in app — ✅ Working

Files: `useResumeParsing.ts`, `CandidateFormSheet.tsx`, `EnhancedResumeDropzone.tsx`, `useBulkCandidateUpload.ts`.

Flow:
1. User drops a PDF/DOCX in the UI.
2. Frontend extracts text with `extractTextFromFile()`.
3. Calls `parse-resume` edge function with `{ textContent, fileName, mimeType, mode }`.
4. Edge function runs OpenAI (`gpt-4o-mini`) — `core` mode (fast, contact fields) or `full` mode (adds Spanish profile summary).
5. Returns `{ name, email, phone, linkedinUrl, location, profileSummary }`.
6. `parseAndUpdateCandidate` writes the missing fields onto the candidate row, then triggers background enrichment.

Code is sound: `OPENAI_API_KEY` is present in secrets, regex fallbacks exist if the AI call fails, phone is normalized to E.164, location is split into city/state/country, only blank candidate fields are overwritten. This path is healthy.

### 2. Public careers page application (`public-submit-application`) — ✅ Working (different design)

This flow does **not** call `parse-resume`. The candidate fills name / email / phone / location directly into the application form, and only the resume **file** is uploaded. After the candidate row is created, the function fires `enrich-candidate-profile` with the `resumeText` for AI skills + profile summary, and `analyze-candidate-fit` for the fit score.

That's intentional — there's nothing to "parse" because the structured fields come from the form itself. Working as designed.

### 3. Talent.com webhook (`talent-apply-webhook`) — ❌ Broken

`supabase/functions/talent-apply-webhook/index.ts:129–143` calls:

```ts
await supabase.functions.invoke('parse-resume', {
  body: { candidateId, resumeUrl, fileName: ... }
})
```

Two problems:

1. **Wrong payload.** `parse-resume` expects `textContent` (and rejects with `400 "Text content is empty or too short to parse"` when it's missing). It doesn't accept `resumeUrl` and never fetches the file itself.
2. **Result is ignored.** Even if the call succeeded, the webhook does nothing with the response — `parse-resume` returns parsed fields but doesn't write to the candidate, so `candidateId` is meaningless here.

Net effect for talent.com applicants: a new candidate gets created with only `name`, `email`, `phone`, `resume_url`, but the AI parsing never enriches the record. Profile summary, location, LinkedIn, etc., stay blank until someone manually re-uploads the resume in-app.

(Note: there are no recent `parse-resume` logs at all in the last window, which is consistent with this — the only caller hitting it is the manual UI flow, and there have been no recent uploads.)

## Proposed fix (Workflow 3 only)

Bring talent.com applicants in line with the public-apply flow:

1. **Stop calling `parse-resume` from `talent-apply-webhook`.** It's the wrong tool here — it expects extracted text, not a URL, and doesn't update the DB.
2. **Call `enrich-candidate-profile` instead**, the same way `public-submit-application` does. That function already handles the case where we only have a URL (or we can pass the resume bytes after downloading from `resumeUrl`), and it writes skills + profile summary back to the candidate.
3. **Also call `analyze-candidate-fit`** for parity with public-apply (fit score pre-generated when the application arrives).
4. Keep the candidate insert as-is — name/email/phone are already provided by talent.com's payload.

Out of scope: changing the manual upload flow or the public-apply flow. Both are working.

### Files to change

- `supabase/functions/talent-apply-webhook/index.ts` — replace the `parse-resume` invocation block (lines ~129–143) with the two fire-and-forget enrichment calls modeled after `public-submit-application/index.ts:727–752`.

No DB migration, no frontend changes, no new secrets.

### Verification after build

- Re-deploy `talent-apply-webhook` (automatic) and replay a sample talent.com webhook with `supabase--curl_edge_functions`.
- Confirm `enrich-candidate-profile` logs show the candidate being processed and the candidate row gains `profile_summary` + skills.

Want me to apply this fix?
