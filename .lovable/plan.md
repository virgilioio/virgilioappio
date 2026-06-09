# Departments → Job Postings & Careers Page

Goal: make **Department** the canonical grouping/filter on every posting surface, end-to-end, using the new workspace-wide `departments` table introduced earlier.

Today the public careers page already groups by `details.department`, but that field is only populated ad-hoc and never synced to the new departments model. We close that gap.

## 1. Persist department on job_postings.details

`JobPostingStep.savePosting` currently builds `details` without department. Add the parent job's department (denormalized name string — already kept in sync via `useJobs.createJob/updateJob`) into the saved blob:

- In `src/components/jobs/wizard/JobPostingStep.tsx` (around line 283), include:
  - `department: jobData?.department ?? null`
  - `department_id: jobData?.department_id ?? null`
- Same treatment wherever a posting is created/updated outside the wizard (search for `createPosting` / posting `details` writes in `useJobPostings.ts` and any posting edit sheets).

## 2. Keep posting department in sync with the job

When a user changes a job's department later, the posting's denormalized snapshot would go stale. Two parts:

- **Client-side**: in `useJobs.updateJob`, after writing the new `department` text, patch `job_postings.details` for that job to overwrite `department` and `department_id`. Single targeted SQL update via supabase client (json `||` merge).
- **DB trigger (defensive)**: `AFTER UPDATE OF department_id ON public.jobs` → updates `job_postings.details = details || jsonb_build_object('department', NEW.department, 'department_id', NEW.department_id)` for matching postings. SECURITY DEFINER, scoped by `job_id`. Belt-and-braces so anything that bypasses the hook stays consistent.

## 3. One-shot backfill migration

Align existing data before the new behavior takes over:

```sql
UPDATE public.job_postings p
SET details = COALESCE(p.details, '{}'::jsonb)
            || jsonb_build_object(
                 'department', j.department,
                 'department_id', j.department_id
               )
FROM public.jobs j
WHERE p.job_id = j.id
  AND j.department IS NOT NULL;
```

Combined with the earlier `jobs.department ← departments.name` backfill, every posting ends up tagged with its current department name.

## 4. Public careers page polish (`PublicCareersPage` + `CareersFilterBar` + `CareersRoleList`)

The plumbing already groups/filters by `r.department`. Small UX fixes so departments feel intentional:

- Fallback label: replace `'Open roles'` default with `'Other'` only when a posting genuinely has no department (rare after backfill).
- Group sort: pin the tenant's system "General" department last; sort the rest alphabetically. Apply same order in the filter dropdown.
- Hide empty filter options: only list departments that actually appear in active postings (already the case — verify).
- Hero metric `departmentsCount` keeps working unchanged.
- No schema changes needed on `careers_page_settings`.

## 5. Internal job-posting UI (no behavior change required, just verify)

- `JobPostingStep` list (line 786) already shows `j.department` from the jobs hook — now powered by the synced field.
- `PublicJobPosting.tsx` (line 628) reads `d.department` from posting details — now reliably populated.
- `JobHero` / `JobOverviewTab` already updated in the prior pass; spot-check after backfill.

## 6. Verify

- Create a job in a non-default department → posting publishes → careers page lists it under that department, filter dropdown includes it.
- Move a job to a different department → careers page reflects new group on next load (trigger fires).
- Existing postings show real department names after backfill, not "Open roles".

## Files touched

- `src/components/jobs/wizard/JobPostingStep.tsx` — include department in saved details
- `src/hooks/useJobs.ts` — sync posting details on department change
- `src/hooks/useJobPostings.ts` — accept/forward department when present (no signature break)
- `src/pages/PublicCareersPage.tsx` — fallback label, sort order, system-dept pinning
- `src/components/careers/public/CareersFilterBar.tsx` — sorted options (if not already)
- New migration: trigger + backfill (section 3)

## Out of scope

- Department color/icon rendering on the public page (can be a later polish using `departments.color`).
- Per-department careers sub-pages / SEO routes.
- Reordering departments manually (alphabetical + system-last is enough for now).
