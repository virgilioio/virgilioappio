## Validation

Confirmed — true on both counts:

1. **Edit posting sheet has no department field.** `src/components/jobs/postings/PostingSheet.tsx` contains zero references to `department`. The sheet lets you edit title, location, employment type, banner, channels, application form, etc., but not the department the posting is filed under.
2. **Careers page groups by `details.department`.** `src/pages/PublicCareersPage.tsx` (line 105) and `VirgilioCareersPage.tsx` (line 104) both do `department: (p.details?.department as string) || 'Other'`. Any posting created without a department name in `details` falls into the "Other" bucket with no way to fix it from the UI.

The wizard writes both `details.department` (name) and `details.department_id` (id) to `job_postings` on creation (`JobPostingStep.tsx` lines 352–380). Older postings — or any created when the wizard skipped the lookup — have empty values and are now stranded.

## Fix Plan

### 1. Add a Department selector to the Edit Posting sheet
In `PostingSheet.tsx`, alongside the existing posting-level fields (near title/location/employment type):

- Add a `SearchableSelect` powered by `useDepartments()` (same hook the wizard uses).
- Pre-select from `posting.details.department_id`; fall back to matching `posting.details.department` by name; otherwise empty.
- Support "Create department" inline (mirroring `JobInfoStep.tsx` behavior) so users aren't blocked.
- On change, persist BOTH fields into `job_postings.details`:
  - `details.department_id` = selected id
  - `details.department` = selected name (denormalized — careers page reads the name directly)
- Reuse the existing posting update mutation (the one that already writes `details` for title/location). No schema change needed — `details` is JSONB.

### 2. Backfill stranded postings (one-time)
Run a data update for postings whose `details.department` is null/empty but whose parent `jobs.department_id` exists:

- For each affected `job_posting`, look up the job's `department_id` → `departments.name`.
- Write both into `details`.

This immediately removes existing postings from "Other" without requiring users to re-open each one.

### 3. Guardrail in the careers page (optional polish)
In `PublicCareersPage.tsx` and `VirgilioCareersPage.tsx`, if `details.department` is missing, fall back to the parent job's department name before defaulting to `'Other'`. This protects against any future posting that slips through without the denormalized name.

### Technical notes

- No migration required — `job_postings.details` is already JSONB and both `department` and `department_id` are already conventions used by the wizard.
- The Edit Posting save path already round-trips `details`, so adding two keys is purely additive.
- The backfill is a single `UPDATE ... FROM jobs JOIN departments ...` statement run via the data tool.
- Keep the change UI-only otherwise; no business-logic changes to the wizard, jobs table, or RLS.