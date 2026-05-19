# Edit Job sheet redesign + Job hero "More actions" menu + Duplicate Job

Two related changes to bring the Job detail experience in line with the new Create Job wizard.

## 1. Redesign the Edit Job sheet

Replace the current `JobFormSheet` content with a single-pane, scrollable sheet matching the reference screenshots (`30h_Edit_job`). Same Gio Foundation tokens used by `JobWizard` / `JobInfoStep`.

**Header (sticky top)**
- Eyebrow: `EDIT JOB` (virgilio-purple, caps, 11.5px Poppins)
- Title: job title + purple period · status badge (Open/Draft/Closed/Archived using `Badge` tones) · candidate count chip (`Badge tone="neutral"`)
- Subtitle (two lines): "Update the role's basics, location, compensation, description, and skills. Changes go live the moment you save."
- Close `X` (top-right ghost iconOnly button)

**Section nav (pill tabs, scroll-spy)**
`Basics · Location & employment · Compensation · Description · Skills`. Clicking scrolls to the section; visible section becomes the active pill. Uses the same pill style as the wizard's secondary chips.

**Sections (all in one scroll, grouped by labeled card)**
- **BASICS** — Job title*, Internal title (optional, "Used in CRM & analytics only"), Status segmented (Draft / Open / Closed / Archived), Department / Organization*, Job level.
- **LOCATION & EMPLOYMENT** — Work mode*, Employment type*, Primary location, Additional locations (chip input).
- **COMPENSATION** — Currency*, Min salary*, Max salary*, three toggle rows: "Show salary on public posting" (recommended), "Include equity", "Include signing bonus".
- **JOB DESCRIPTION** — Right-aligned "Last edited by Gio" lilac badge (when applicable) + "Rewrite" ghost button. `RichTextEditor` (Markdown). Inline lilac "Generate with Gio" CTA bottom-right inside the textarea container. Helper: "Markdown supported. Includes overview, responsibilities, requirements."
- **REQUIRED SKILLS** — `Gio added N` lilac badge top-right. Skill chips with color tones, Add skill input, Min years / Max years (optional).
- **EDITED ELSEWHERE** (read-only card group) — three rows linking to Job Setup subtabs: Hiring plan → Setup · Plan, Hiring team → Setup · Team, Job posting → Setup · Posting. Each row has icon, title, subline, right-aligned link with arrow.
- **DANGER ZONE** (soft red-tinted card) — "Close or archive this job" with `Close job` (secondary) and `Archive` (danger outline) buttons. Delete stays in the hero `More actions` menu, not here.

**Footer (sticky bottom)**
- Left: `Cancel` link + small clock icon "Last edited Xd ago by {member}"
- Right: `Preview posting` (secondary, eye icon) + `Save changes` (primary)
- Primary save disabled until validation passes; shows loading state while saving.

**Behavior**
- Reuse all current `JobFormSheet` data flow (`onSubmit`, hooks). Add only the new fields that map to existing job columns (`internal_title`, `job_level`, `work_mode`, `employment_type`, `additional_locations`, `show_salary`, `include_equity`, `include_signing_bonus`) — wire them where they already exist; for any not yet in `useJobs`, render the control but mark TODO in code without schema changes (no migrations in this plan).
- Hiring team editor is removed from the sheet (handled in Setup · Team).
- Sheet width grows: `sm:max-w-[860px]`.

## 2. Job hero "More actions" dropdown

Replace the existing `MoreHorizontal` icon button to the right of `Add candidate` in `JobHero.tsx` with a real `DropdownMenu` (Gio dropdown chrome, `align="end"`, sideOffset 8). Items, in order:

1. `Edit job` (Pencil)
2. `Duplicate job` (Copy)
3. `Close job` (XCircle) — hidden if already closed/archived
4. `Archive` (Archive)
5. — divider —
6. `Delete job` (Trash, danger styling, last position per style guide)

Wire each item to existing handlers from `JobDetail.tsx` (`onEdit`, `onArchive`, `onDelete`, close = status update to `closed`). Confirmation dialogs already exist for archive/delete; add a small confirm for Close.

## 3. Duplicate job

New handler `handleDuplicate(job)` on `JobDetail.tsx` that opens the existing `JobWizard` pre-filled from the source job.

- Extend `JobWizard` props with optional `initialData?: Partial<CreateJobData> & { sourceJobId?: string }`.
- When `initialData` is set, seed `wizardState.jobData` in `resetWizard` / on open. Title becomes `"<Original title> (copy)"`. Status forced to `draft`. `organization_id`, description, skills, salary, location, level, work mode, employment type, additional locations all copied.
- Do NOT carry over: candidates, hiring team assignments, hiring plan customizations, job postings (user can opt into copying the application form on Step 4 via the already-built "Copy from another job" pill, pre-selected to the source).
- Add a top callout in Step 1 of the wizard when duplicating: lilac `Alert` "Duplicating from {Original title} — review and edit before publishing."

## Out of scope

- New database columns/migrations.
- Changes to Setup tabs (Plan / Team / Postings / Sourcing).
- Bulk duplicate or templating.

## Technical notes

- Files touched:
  - `src/components/jobs/JobFormSheet.tsx` — full rewrite of the sheet body; keep exported component name + props so `Jobs.tsx` and `JobDetail.tsx` callers don't change.
  - `src/components/jobs/JobHero.tsx` — replace inline `MoreHorizontal` button with `DropdownMenu`; add `onEdit`, `onDuplicate`, `onClose`, `onArchive`, `onDelete` callback props (keep `onMoreActions` as deprecated fallback).
  - `src/pages/JobDetail.tsx` — wire new hero callbacks + duplicate flow; open `JobWizard` with `initialData`.
  - `src/components/jobs/JobWizard.tsx` — accept `initialData`; seed `wizardState.jobData`; add duplicating banner in step 1.
  - `src/pages/Jobs.tsx` — pass duplicate handler through if list rows also expose it (optional follow-up; not required this pass).
- Reuse: `Badge`, `Button`, `DropdownMenu`, `Switch`, `Input`, `Select`, `RichTextEditor`, `MemberAvatar` (none needed here), `Alert`.
- All section cards use existing `bg-virgilio-cream`/hairline border pattern from `JobInfoStep` for visual parity with the wizard.
