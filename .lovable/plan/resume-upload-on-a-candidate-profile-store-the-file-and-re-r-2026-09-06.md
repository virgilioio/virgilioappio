# Resume upload on a candidate profile: store the file and re-read it with Gio

## Answering your question first

No — nothing ran. On the standalone candidate profile, the Resume tab's upload box is wired in "preview only" mode: it reads the file in the browser, throws the result away, and never saves the file or updates the profile. So there was no parsing, no summary refresh, no skills, no experience or education update. That's why today's upload left no trace.

Separately, Esme *does* already have a resume on file — a CV.pdf uploaded on 28 January, and Gio did read it back in March (that's where her current summary, 10 skills, 2 roles and 1 education entry came from). The Resume tab looked empty because it checks the wrong place: it looks at a single field on the candidate record instead of her actual attachments list. So there are two separate faults here.

## What will change

1. **Uploading a resume actually saves it.** The upload box and the "Upload"/"Replace" buttons will save the file as a candidate attachment, marked as the resume, exactly like the in-job profile already does. The Resume tab then shows it immediately.
2. **The Resume tab looks in the right place.** It will consider a resume present when there's a resume attachment, so Esme's January CV shows up right away instead of an empty upload box.
3. **Gio re-reads the new resume automatically.** As soon as the upload finishes, the reading starts in the background, and the new resume becomes the truth — summary, skills, work experience and education are rewritten from it (your chosen behaviour).
4. **The profile shows it's working, then refreshes itself.** A "Gio is reading this resume" note appears while it runs, and the profile, Experience and Education tabs refresh on their own when it's done — no manual reload.
5. **Replacing a resume replaces cleanly.** The previous resume stops being the primary one so the viewer and the reader always use the newest file.

Layout, tabs and permissions stay as they are.

## Technical detail

- `src/pages/IndependentCandidateProfile.tsx`
  - Replace the local `handleResumeUpload` (which writes `candidates.resume_url` only, with no attachment row and no cache invalidation) with `useCandidateAttachments(candidate.id).uploadAttachment(file, true)`.
  - Fix the Resume tab gate: `resumeOnFile` currently equals `!!candidate.resume_url` (null for Esme). Derive it from the attachments list (`attachments.some(a => a.is_resume) || attachments.length > 0`), falling back to `resume_url`. Pass `candidateId` to `CandidateResumeViewer` so it resolves the attachment itself instead of relying on `fallbackResumeUrl`.
  - The `EnhancedResumeDropzone` on the Resume tab is configured `showUpload={false} parseOnly={true}` with no `onParsed`, so `onUpload` is never called. Change to `showUpload onUpload={handleResumeUpload}` and drop `parseOnly`.
- Re-read trigger: after a successful upload, call `triggerBackgroundEnrichment(candidate.id)` from `src/hooks/useCandidateEnrichment.ts` with no `resumeText`, so `enrich-candidate-profile` pulls the newest resume attachment from storage. That function already deletes and re-inserts `candidate_work_experience` / `candidate_education`, which matches "replace with the new resume". Do not route through `parseAndUpdateCandidate` — it is gap-fill only (`profile_summary` guarded by a length check) and never touches experience/education.
- Summary/skills overwrite: verify `enrich-candidate-profile` writes `profile_summary` and skills unconditionally on this path; if it currently skips a populated summary, add a force flag on the request (`{ candidateId, force: true }`) rather than changing the creation-time behaviour.
- Progress + refresh: read `candidates.enrichment_status` (`processing` → in-progress note) and, on completion, invalidate `['independent-candidate', id]` plus refetch the work-experience/education effect in the page (currently a one-shot `useEffect` keyed on `candidateId`; give it a refresh key bumped when enrichment finishes).
- Primary-resume handling: `useCandidateAttachments` already exposes `setPrimaryResume`; call it for the new file so older attachments stop being `is_resume`.
- No schema, RLS, or new edge functions. Existing `enrich-candidate-profile` is reused as-is unless the force flag proves necessary.

## After it ships

Esme's January CV will appear in her Resume tab straight away. Re-upload her current resume and Gio will refresh her summary, skills, roles and education from it within a minute or so.
