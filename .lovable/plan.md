## Fix: Supply Chain missing from careers page filter

### Root cause
- The careers page derives its department dropdown only from currently-published roles.
- The single "Supply Chain" job (`Jefe de Almacén`) has its `job_postings.is_active = false`, so it never reaches the public page → "Supply Chain" never appears.

### Changes

**1. Data fix — activate the dangling posting**
- Set `job_postings.is_active = true` for the `Jefe de Almacén` posting (parent job is already `open`, so the close-trigger won't reverse it).

**2. Careers filter dropdown — show every workspace department**
Currently `PublicCareersPage.tsx` builds `departments` from `roles`. Change it to fetch all active departments for the tenant (anonymous read) and use that list in `CareersFilterBar`.

- New query in the same `useEffect`:
  ```ts
  supabase.from('departments')
    .select('name')
    .eq('tenant_id', s.tenant_id)
    .eq('is_archived', false)
    .order('name')
  ```
- Store the names in state (`allDepartments`), pass them as the `departments` prop to `CareersFilterBar`.
- Keep the existing pin-last sort for `General` / `Other`.
- The hero's `departmentsCount` continues to reflect departments **with open roles** (unchanged), since the count signals "areas hiring now".
- RLS check: `departments` already has a public-anon SELECT policy? If not, add a minimal anon read policy scoped to active careers tenants. (Will verify before writing migration; if missing, add an `anon SELECT` policy on `departments` filtered by `is_archived = false`.)

**3. No code change to `useJobs` / postings hook**
Existing inner-join + `is_active = true` guard stays. We're only widening the dropdown source.

### Files touched
- Data update (via insert tool): activate one `job_postings` row
- `src/pages/PublicCareersPage.tsx` — fetch + pass workspace departments
- Possibly a small migration: anon SELECT policy on `public.departments` if not already granted

### Out of scope
- Auto-activating postings when a job's department is set (still an explicit user action)
- Re-styling the dropdown
