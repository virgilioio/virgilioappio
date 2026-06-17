## Problem

1. **Job dropdown correctly hides non-open jobs** — but the wizard defaults new jobs to `status = 'draft'`, so a job the user just "created" through the full wizard stays a draft and is (correctly) excluded from the Add Candidate picker. The wizard already has a status field, but its default is wrong for a user who walked all the way through to the Summary step and clicked the final Create/Publish action — at that point they clearly intend the job to be open, not a draft.

   Confirmed already-correct behavior:
   - `useJobsForCandidateAssignment` filters `status = 'open'` → keep as-is (don't pollute dropdowns with drafts/closed/archived).
   - `useJobs.createJob` already persists whatever `status` the wizard hands it via `...jobData`.
   - When the Add Candidate sheet is opened from inside a job, `CandidateFormSheet` auto-selects that job via the `jobId` prop.

2. **Professional section is manual.** Resume parsing currently fills name, email, phone, LinkedIn, location, profile summary — but not Current role, Current company, or Years of experience. The data lives in the resume; the user shouldn't have to retype it.

## Plan

### 1. Default the wizard's final-step submission to `status = 'open'`

Keep the dropdown filter strict (`status = 'open'` only). Fix the source instead:

- `src/components/jobs/JobWizard.tsx`: in the submit handler that calls `createJob(wizardState.jobData)` (around line 184), ensure the payload is `{ ...wizardState.jobData, status: wizardState.jobData.status ?? 'open' }`. This only flips the default when the user never touched the status field; if they explicitly set Draft/Closed/etc. in Step 1, we respect that.
- `src/components/jobs/wizard/JobInfoStep.tsx`: change the displayed default in the status Select from `'draft'` to `'open'` (lines 116, 239 area) so the UI matches what we'll save. Users who want a draft can still pick it explicitly; users who want "Save & exit" without finishing the wizard continue to get a draft via the existing save-as-draft path (unchanged).
- Do **not** modify `useJobsForCandidateAssignment` — drafts/closed/archived continue to be excluded so the dropdown stays focused on actionable jobs.

### 2. AI-parse the Professional fields from the resume

Extend the existing `parse-resume` edge function and client wiring to return three new fields and apply them to the form.

**Edge function** (`supabase/functions/parse-resume/index.ts`):
- Add `currentRole`, `currentCompany`, `yearsExperience` (integer) to the `ParseResult` type and to the JSON schema in both `core` and `full` system prompts.
- Extraction rules:
  - `currentRole`: most recent job title (top of Experience, or the one marked "Present").
  - `currentCompany`: company name for that most recent role.
  - `yearsExperience`: integer total years of professional experience. If not explicitly stated, infer from the earliest professional start date to today, rounded to nearest whole year. Null if unclear (anti-hallucination — never guess).
- Bump core-mode `max_tokens` from 300 → 500 to fit the additional fields.

**Client type** (`src/hooks/useResumeParsing.ts`):
- Extend `ParsedResume` with `currentRole?: string`, `currentCompany?: string`, `yearsExperience?: number`. Add them to the `console.log` summary so debugging stays useful.

**Form wiring** — only set when the field is currently empty (never overwrite user input):
- `src/components/candidates/CandidateFormSheet.tsx`: in the parse-resume `onParsed` handler, call `setValue('current_role', …)`, `setValue('current_company', …)`, `setValue('years_experience', String(…))` when parsed values exist and the corresponding form field is blank.
- `src/components/candidates/IndependentCandidateForm.tsx`: mirror the same setters in its `onParsed` callback (around lines 240-303).
- Confirm `src/components/candidates/ApolloPreviewSheet.tsx` and any other consumer of `ParsedResume` doesn't need a matching change.

### Out of scope
- No DB migrations. `current_role` / `current_company` / `years_experience` are already part of the form payload.
- No change to RLS/role logic in `useJobsForCandidateAssignment` — only the status default in the wizard changes.
- No change to the "auto-select job when opened from inside a job" behavior — already works.

## Verification
- Complete the job wizard to Summary and submit → the new job is created with `status = 'open'` and appears immediately in the Add Candidate "Assign to a job" dropdown (both from top-bar "New Candidate" and from inside another job).
- Save a job as Draft (explicitly) → it does **not** appear in the dropdown. ✔ correct behavior.
- Open Add Candidate from inside a job → that job is pre-selected (unchanged).
- Upload a resume in the Add Candidate sheet → Current role / Current company / Years of experience auto-fill alongside the other parsed fields.
