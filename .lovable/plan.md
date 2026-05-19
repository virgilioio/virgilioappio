# Add "Job posting" step to the Job Wizard

Insert a new fourth step — **Job posting** — into the create-job wizard, between *Hiring team* (current step 3) and *Summary* (current step 4, becoming step 5). The step lets the user optionally create a real, public job posting as part of job creation. If created, it is wired to the existing `job_postings` system so the public posting URL works exactly as it does today from the standalone *Job Postings* tab.

## What the user sees

A new step with the same wizard chrome ("Create job · Step 4 of 5", "Job posting", `AI assisted` badge, subtitle "The public-facing listing — how candidates discover, read, and apply to this role."). The body is a single scrollable column with these sections, in order, matching the uploaded screenshots:

1. **Posting basics** — Public job title (defaults to internal title), URL slug (auto-generated, editable), Reference ID (optional), Posting language, Application deadline (optional), `Show in public job search` toggle, `Show 'apply within 24h response' badge` toggle. Badge: `Pulled from step 1`.
2. **Public description** — Markdown textarea pre-filled with the JD from step 1 (if any), but stored independently so edits don't propagate back. "Generate with Gio" / "Rewrite" actions reuse the existing `generate-job-description` edge function. Inclusion-score callout below (visual only for now).
3. **Branding** — Hero banner upload, brand color picker + swatches, `Show team photos on posting` toggle, `Embed culture video` toggle. Badge: `Inherits from workspace`.
4. **Application form** — 9 default fields (Full name, Email, Phone, Resume/CV, LinkedIn/portfolio, Work authorization, Notice period, Salary expectations, Why interested). Full name + Email locked (`Required by Gio`). Rest drag-reorderable, required/optional toggle, delete. `+ Add question`. EEO survey toggle at the bottom.
5. **Where to publish** — Channel rows for Careers page (Always on), LinkedIn, Welcome to the Jungle, ZipRecruiter, Google for Jobs, Indeed. Each row: logo, name, sub-label, status pill, toggle. Running-total card at the bottom (`Posting total · …`). `Manage integrations` link top-right.
6. **Apply experience** — Send confirmation email, Promise first response in 48h, Allow candidate to message recruiter, Enable referral link (with trackable URL preview).
7. **SEO & sharing** — Meta title (60-char hint), Meta description (155-char hint), rendered Social card preview using brand color + title + description. Badge: `Gio generated`.
8. **Preview footer rail** — Sticky footer shows `Posting to N channels · application form M fields` summary in the middle, `Preview posting` button left of the primary CTA, `Continue to review` as the primary CTA.

The step is **optional**: a small "Skip — I'll create the posting later" link sits in the footer next to Back. Skipping leaves no `job_postings` row and jumps to Summary.

## What gets wired vs. visual-only

Goal: the things the existing public posting actually uses must work end-to-end. Decorative/integration features stay as local state with a TODO comment, so they don't break and can be wired later.

Wired to backend (creates/updates a `job_postings` row via the existing `useJobPostings` hook):
- Public title → `title`
- URL slug → `slug` (collision suffix handled by existing `generateSlug`)
- Description (markdown rendered as HTML) → `description`
- Language, reference ID, deadline, search visibility, response-time badge → stored in `details` JSON
- Application form fields → existing `posting_fields` builder pipeline (`PostingFieldsBuilder`-equivalent persistence, reusing its hooks)
- Branding (banner URL, brand color), Apply experience toggles, SEO meta → all stored in `details` JSON so the posting page can read them later

Visual-only this pass (local state, not persisted; clearly marked in code):
- Inclusion score, "Gio rewrote" badge state
- LinkedIn / Welcome to the Jungle / ZipRecruiter / Google for Jobs / Indeed toggles + running-total card (Careers page row remains the only real publish target via existing flow)
- Team photos toggle, culture-video embed toggle
- Social-card preview rendering (read-only mirror of meta fields)

This matches the user's note: "We'll work on those wiring later."

## Description pre-fill behaviour

When the step opens for the first time, if `jobData.description` (from step 1) is non-empty, copy it into the local posting-description state once. After that, the two are independent: editing here does not write back to `jobData.description`, and re-opening the step does not re-overwrite local edits (tracked by a `hasInitializedDescription` ref).

## Save & navigation

- The new step's **Continue to review** primary CTA calls a single `savePosting()` that upserts a `job_postings` row for `createdJobId` using `createPosting` / `updatePosting` from `useJobPostings`, then advances to Summary. Failures show a toast and keep the user on the step.
- Skip path advances without creating a row.
- Back goes to Hiring team.
- Auto-save badge in the left rail keeps current copy.

## Wizard scaffolding changes

- `STEPS` array becomes 5 entries: Job information, Hiring plan, Hiring team, **Job posting**, Summary.
- `STEP_META` adds entry 4 (eyebrow `Step 4 of 5`, title `Job posting`, AI badge true) and renumbers Summary to `Step 5 of 5`.
- `renderStepContent` adds `case 4: <JobPostingStep …/>` and Summary moves to `case 5`.
- `primaryCta` adds case 4 (`Continue to review`, calls `savePosting` then advance) and Summary stays as final `Publish job`.
- `canProceed` for step 4: always true (skippable).
- Left rail renders 5 items now (heads-up: previous steps' own internal copy referencing "step X of 4" is intentionally left alone per the user's note).

## Files

New:
- `src/components/jobs/wizard/JobPostingStep.tsx` — the step container + all 7 sections, owning local form state and the `savePosting` call.
- `src/components/jobs/wizard/job-posting/PostingBasicsSection.tsx`
- `src/components/jobs/wizard/job-posting/PublicDescriptionSection.tsx` (reuses `generate-job-description`)
- `src/components/jobs/wizard/job-posting/BrandingSection.tsx`
- `src/components/jobs/wizard/job-posting/ApplicationFormSection.tsx` (wraps existing `PostingFieldsBuilder` once a posting row exists; before that, shows the default field list in local state and persists on save)
- `src/components/jobs/wizard/job-posting/PublishChannelsSection.tsx`
- `src/components/jobs/wizard/job-posting/ApplyExperienceSection.tsx`
- `src/components/jobs/wizard/job-posting/SeoSharingSection.tsx`

Edited:
- `src/components/jobs/JobWizard.tsx` — STEPS, STEP_META, renderStepContent, primaryCta, footer summary text.

No DB schema changes. No edits to existing posting code paths (`PostingSheet`, `JobPostingsTab`, `useJobPostings`) beyond consumption.

## Out of scope

- Real LinkedIn / Indeed / ZipRecruiter / Welcome to the Jungle / Google for Jobs integrations (toggles are stubs).
- Hero banner upload pipeline and culture-video embed storage.
- Inclusion-score AI scoring.
- Editing the previous three steps' internal "step X of 4" copy.
- Changing how the public posting page renders.
