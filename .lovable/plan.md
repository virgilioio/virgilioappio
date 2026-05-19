# Step 1 — "Generate with Gio" for Job Description

Make the **Generate with Gio** button in the Job description section of Job Wizard Step 1 actually generate a markdown job description from whatever the user has already typed in the wizard (no save required).

## Scope

In scope:
- Wire the existing `Generate with Gio` button in `JobInfoStep.tsx`.
- Send the in-memory `jobData` (title, internal title, departments/organization, job level, work mode, employment type, primary location, additional locations, employment seniority, salary range/currency, skills if present, etc.) to a new edge function.
- Stream/return a clean markdown description and write it into the `description` textarea (replace contents; if textarea has user content, ask via a tiny confirm before overwriting).
- Client-side validation: if `title` is empty OR `job_level` is empty, do **not** call the function. Show inline validation message under the button: *"Add at least a job title and job level so Gio can draft a description."*
- Loading state on the button (spinner + "Generating…", disabled) and toast on error (rate-limit 429, credits 402, generic).

Out of scope:
- Saving the job, persisting drafts, editing the prompt, multi-language toggle, regenerate variants, or affecting any other wizard step.
- Touching the existing `generate-job-spec` function (it's for the full spec assistant, not this inline button).

## UX details

- Button stays in the SectionCard trailing slot, same styling.
- While generating: button shows spinner, label becomes "Generating…", disabled.
- If validation fails: button does nothing; a small `text-destructive` hint appears for ~4s under the textarea (no toast).
- If textarea already has >20 chars of content, show a `confirm()` "Replace current description with AI-generated one?" before overwriting.
- Output: markdown with the three sections already hinted in the placeholder (`## About the role`, `## What you'll do`, `## What we're looking for`) plus `## Requirements` / `## Nice to have` when info supports it.

## Technical

**New edge function:** `supabase/functions/generate-job-description/index.ts`
- Auth: validate JWT from `Authorization` header, look up active member → tenant.
- Body: `{ jobData: Partial<CreateJobData> }`.
- Server-side guard: re-check title + job_level present; return 400 with `{ error: "insufficient_context" }` otherwise.
- Uses **Lovable AI Gateway** via AI SDK (`@ai-sdk/openai-compatible` + `ai`), model `google/gemini-3-flash-preview`, non-streaming `generateText` for simplicity.
- System prompt: senior recruiting writer; output **markdown only**, no preamble, language = English (match title language if obviously non-English).
- Returns `{ description: string }`.
- Handles 402/429 from gateway and forwards status to client.

**Client changes:** `src/components/jobs/wizard/JobInfoStep.tsx`
- Add `isGenerating` state, `validationMsg` state.
- `handleGenerate()`: validate → optional confirm → `supabase.functions.invoke('generate-job-description', { body: { jobData } })` → `set('description', data.description)`.
- Pass `onClick`, `loading`, `disabled` to the existing `<Button>`.

**Secrets:** `LOVABLE_API_KEY` (auto-managed, will provision if missing).

## Files touched

```text
supabase/functions/generate-job-description/index.ts   (new)
src/components/jobs/wizard/JobInfoStep.tsx             (button wiring + state)
```
