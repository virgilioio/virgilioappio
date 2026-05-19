# Complete the redesigned Edit Job sheet

Polish the new `JobFormSheet` so all five sections render correctly, the section nav scroll-spy works reliably, and saving an existing job persists every editable field.

## What's working today
- Sheet shell, header (eyebrow, title + purple period, status badge, candidate count, close button), section pill nav, scroll body, footer with `Cancel` / `Preview posting` / `Save changes`, "Edited elsewhere" group, and danger zone are all in place.
- `JobInfoStep` already renders the five SectionCards (Basics, Location & Employment, Compensation, Job description, Required skills) reused from the wizard.
- `handleJobFormSubmit` in `JobDetail.tsx` calls `updateJob(id, jobData)` and refetches.

## Gaps to close

### 1. Section nav anchoring
- `AnchoredJobInfo` tags `<section>` children inside a `useEffect([])`. JobInfoStep mounts before the inner sections are queried in some renders → pills don't scroll-spy, and clicking a pill jumps nowhere.
- Replace with `useLayoutEffect` + a `MutationObserver` (or simply re-run when `jobData` length-affecting keys change) so every SectionCard gets the correct `data-section` id before the first scroll/spy pass.

### 2. Duplicate Compensation card
- We currently render JobInfoStep's "Compensation" (currency + min/max) **and** a separate "Public posting compensation" SectionCard below it for the three toggles. That's confusing and duplicates the section title.
- Merge: extend `JobInfoStep`'s Compensation SectionCard with the three toggles (`show_salary_public`, `include_equity`, `include_signing_bonus`) below the salary grid. Remove the standalone card from the sheet. Toggles already exist in `_parts` (`ToggleRow`) and the wizard summary already references them, so this is a single-source-of-truth fix.

### 3. Duplicate Status control
- JobInfoStep renders a Status Segmented inside Basics. In the edit sheet the status is already shown as a header badge and is mutated via the Danger zone (Close/Archive). Two controls = inconsistent state.
- Add an optional `hideStatus?: boolean` prop on `JobInfoStep` and pass `hideStatus` from the edit sheet. Wizard usage stays unchanged.

### 4. Save path correctness
- `handleSubmit` builds `payload = { ...jobData }` and deletes `organization_id` when editing. Confirm and harden:
  - Drop empty-string fields (`internal_title`, `job_level`, `work_mode`, `employment_type`, `location`) so we send `null` instead of `""` for nullable enums (otherwise Postgres rejects empty enum strings).
  - Coerce salary fields: send `null` when cleared, numbers otherwise.
  - Pass `additional_locations` as `[]` rather than `undefined` when user removed all chips.
  - Never send `skills: undefined` — default to existing or `[]`.
- Show a small inline error toast (already handled by `useJobs`); confirm the sheet only closes on success (it already awaits `onSubmit` then `onClose`).

### 5. Validation surface
- `isValid` only checks `title` + `organization_id`. JobInfoStep marks `work_mode` and `employment_type` as required. Either:
  - Extend `isValid` to include those two enums, OR
  - Mark them optional (no asterisk) for the edit case since some legacy jobs lack them.
- Decision: keep the asterisk but in the edit sheet treat them as required only if the field is currently non-null on the job. New edits cannot null them out, but legacy jobs without the value can still be saved.

### 6. Deep-link "Edited elsewhere"
- `onGoToSetup` currently only switches `activeTab` to `job-setup`. Wire the `subtab` argument through to `JobSetupLayout` (URL search param `?setup=plan|team|posting`) so clicking "Hiring plan / Team / Posting" lands on the right tab.

### 7. Minor polish
- Last-edited footer chip: skip rendering when `job?.updated_at === created_at` (untouched draft).
- Header subtitle: hide the 2-line description when the job is `archived` or `closed`; replace with a muted note "Read-only — reopen the job to edit live fields."
- When `status === 'archived'` or `closed`, set form fields read-only via `fieldset[disabled]` wrapping the scroll body, and disable `Save changes` (keeping danger-zone buttons live for unarchive flow in a later iteration).

## Files to touch
- `src/components/jobs/JobFormSheet.tsx` — anchoring fix, drop duplicate compensation card, save-payload sanitization, validation update, read-only state, deep-link argument.
- `src/components/jobs/wizard/JobInfoStep.tsx` — add `hideStatus` prop; merge public-posting toggles into the Compensation SectionCard.
- `src/pages/JobDetail.tsx` — pass `hideStatus` (implicit by sheet), implement `onGoToSetup` deep-link (push `?setup=<subtab>` on the URL), keep existing `handleJobFormSubmit`.
- `src/components/jobs/JobSetupLayout.tsx` (or equivalent) — read `?setup=` on mount and select that subtab.

## Out of scope
- Wizard (`JobWizard.tsx`) layout changes beyond the new `hideStatus` prop.
- Hiring-team / hiring-plan / posting form rewrites — those stay in their own setup tabs.
- DB migrations — every field already exists on `public.jobs`.
- Reopen-from-archived flow (separate ticket).
