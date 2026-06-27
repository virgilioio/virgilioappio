# Make "Start sourcing for this job" actually source candidates

## Where we are today

There are three entry points that should produce a runnable sourcing project for a job:

1. **Job Wizard → finish step** with "Auto-source" toggled on (`JobWizard.tsx → handleComplete`).
2. **Job detail → Sourcing tab → "Start sourcing for this job"** (`JobSourcingTab.tsx → handleStart`).
3. (Reference) **Find → AI search** — works correctly today, uses `create-sourcing-project` + AI-built criteria.

Both #1 and #2 ultimately call `useJobSourcingProject.ensureProject`, which does a bare `INSERT` into `sourcing_projects` with `search_criteria = { skills, location, level }` (or `{}` for the Sourcing tab). No `title_keywords`, no `locations[]`, no `job_spec_data`.

The downstream worker, `supabase/functions/sourcing-search/index.ts`, hard-exits at line 53:

```ts
if (!criteria?.title_keywords?.length) {
  return { candidates: [], source_breakdown: {pdl:0, apollo:0, ...} }
}
```

So a project is created, but the search returns zero candidates — which is exactly the symptom the user reports.

The healthy path used by `/find` calls `create-sourcing-project` with an AI-built `search_criteria` (including `title_keywords`, `locations[]`, `keywords`, `seniorities`, optional researched companies) plus a `job_spec_data` snapshot. That's what we need from a job too.

## Where we need to be

When the user finishes the wizard with auto-source ON, or clicks "Start sourcing for this job" on the Sourcing tab, the project that's created must be **ready to return candidates immediately**, using everything we already know about the job (title, alt titles, location, work mode, level/seniority, min/max years, skills, must-have skills, salary range, department).

## Plan

### 1. New edge function `create-sourcing-project-from-job`

Server-side, authenticated. Input: `{ job_id: string }`. Steps:

1. Load the job (title, internal_title, location, additional_locations, work_mode, location_requirement, job_level, min/max_years_experience, skills, must_have_skills, salary_min/max, currency, department, organization_id, tenant_id).
2. If a non-archived sourcing project already exists for `job_id`, return it (idempotent — matches `ensureProject` semantics).
3. Build `search_criteria` from the job:
   - `title_keywords`: `[title]` plus `internal_title` if different. Optionally call `research-sourcing-criteria` to add 2–4 AI-suggested alt titles (keep the call best-effort; degrade gracefully on failure).
   - `locations`: `[location, ...additional_locations]` normalized; empty when `work_mode === 'remote'` and no city is set.
   - `skills`: `job.skills`.
   - `keywords`: `must_have_skills` (used as soft keywords).
   - `seniorities`: derived from `job_level` (`L1→entry|junior`, `L2→senior`, `L3→manager`, `L4→director`, `L5→vp|c_suite`).
   - `experience_years`: `{ min: min_years_experience, max: max_years_experience }`.
   - `salary_min`/`salary_max`/`currency`: from job.
4. Build `job_spec_data` snapshot mirroring what `generate-job-spec` produces (job_title, job_description, level, department, location, location_details, salary_range, skills) so the sourcing project UI renders the same brief card as AI-created projects.
5. Insert into `sourcing_projects` with `organization_id`, `created_by`, `job_id`, `name = "Sourcing — {title}"`, `search_criteria`, `job_spec_data`, `enabled_sources = ['internal','apollo']`, `status = 'active'`.
6. Best-effort kick off the first search by invoking `sourcing-search` with the new project id (fire-and-forget — don't block the response). This warms PDL/Apollo caches so the user sees candidates the moment they open the project.
7. Return `{ id, job_id, name, status, organization_id }`.

### 2. Wire the frontend to the new function

- `src/hooks/useJobSourcingProject.ts`
  - Replace the raw `insert` inside `ensureProject` with `supabase.functions.invoke('create-sourcing-project-from-job', { body: { job_id } })`.
  - Keep the "fetch existing first, return it" guard (still useful for instant UI). Drop the `opts.seed` parameter — the server derives everything from the job. Keep `opts.name` only as an override.

- `src/components/jobs/JobSourcingTab.tsx`
  - `handleStart` already calls `ensureProject({ name: 'Sourcing — {jobTitle}' })`. After the change it will actually produce a populated project. No further UI change needed beyond keeping the loading state.

- `src/components/jobs/JobWizard.tsx → handleComplete`
  - Drop the hand-built `seed: { skills, location, level }` (now obsolete).
  - Continue calling `ensureSourcingProject({ name })` only when `autoSource` is true and a real `createdJobId` exists.

### 3. Backstop: make `sourcing-search` survive a thin payload

To prevent silent zero-result projects in the future, when `title_keywords` is missing but the project has a `job_id`, `sourcing-search` should re-derive `title_keywords` from `jobs.title` (and `internal_title`) before the early return. Cheap, defensive, no behavior change for healthy projects.

### 4. Verification

After implementation, manually verify on the existing job `2058c74a…` (Vendedor Hunter):

1. Open Job → Sourcing tab → click "Start sourcing for this job".
2. Confirm a new `sourcing_projects` row exists with `title_keywords = ['Vendedor Hunter', ...]`, `locations = ['Tlaquepaque']`, `skills = [...]`, `job_spec_data` populated.
3. Confirm `/find/{id}` shows Apollo/PDL candidates (not the empty state).
4. Re-run the job wizard end-to-end with auto-source ON and confirm the same outcome.

## Technical notes

- All schema is already in place — `sourcing_projects.job_spec_data`, `job_id`, `enabled_sources` exist. No migration needed.
- RLS on `sourcing_projects` already allows tenant-scoped inserts via service role; the edge function uses the service role client, same pattern as `create-sourcing-project`.
- The fire-and-forget `sourcing-search` call uses `supabase.functions.invoke` without awaiting — wrap in `EdgeRuntime.waitUntil` if available, else swallow the promise.
- Files touched:
  - new: `supabase/functions/create-sourcing-project-from-job/index.ts`
  - edit: `src/hooks/useJobSourcingProject.ts`
  - edit: `src/components/jobs/JobWizard.tsx` (remove dead seed)
  - edit: `supabase/functions/sourcing-search/index.ts` (defensive title_keywords fallback from job)
