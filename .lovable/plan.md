# Finish the Edit Job sheet — background + save wiring

Two focused fixes. Layout, structure, and section distribution stay exactly as designed.

## 1. Fix the "transparent" body background

Root cause: the sheet uses `bg-virgilio-cream`, but that token does not exist in `tailwind.config.ts` or `index.css`. The class compiles to nothing, so the form area shows through to whatever is behind the SectionCards.

Fix: replace `bg-virgilio-cream` on `SheetContent` with `bg-[#FAFAF7]` (the standard Gio off-white surface already used across the wizard — `JobPostingStep`, `SummaryStep`, `HiringPlanStep`). White SectionCards now sit on a proper warm-neutral canvas.

File: `src/components/jobs/JobFormSheet.tsx` — single class swap on `SheetContent`.

## 2. Wire every field to save correctly

The current `handleSubmit` spreads `jobData` raw into `onSubmit`. Two real bugs:
- Empty strings for nullable enum/text columns (`work_mode`, `employment_type`, `job_level`, `internal_title`, `location`, `description`) get sent as `""` and Postgres rejects empty enum strings.
- Salary and years-of-experience inputs can submit `""` or `NaN` instead of `null`.

Replace `handleSubmit` with a sanitizer that:
- Trims strings and converts empty → `null` for nullable text/enum columns.
- Coerces salary + experience to `Number | null`.
- Defaults `currency` to `USD`, `show_salary_public` to `true`, booleans to `false`.
- Always sends `skills` and `additional_locations` as arrays (never undefined).
- Strips `organization_id` on edits (already correct).
- Includes `status` so the segmented control in Basics persists.

After save, the sheet already awaits `onSubmit` then calls `onClose`, and `JobDetail.handleJobFormSubmit` already calls `refetch()` — so the UI reflects changes immediately.

File: `src/components/jobs/JobFormSheet.tsx` — rewrite the `handleSubmit` body only.

## Verification
- Open Edit Job, change title + work_mode + salary + skills → Save → toast "Job updated successfully", header reflects new title on reopen.
- Clear a salary field, clear work_mode (via segmented reset) → Save succeeds, DB row shows `null`.
- Reopen the sheet after save → all values re-hydrate from `useJobs` exactly as saved.

## Out of scope
- No layout or section changes.
- No `JobInfoStep` changes.
- No new DB columns.
