
## Why nothing shows on /virgilio-careers

The public careers query requires `jobs.status = 'open'` AND `job_postings.is_active = true`. Today, for the Virgilio internal org, there is exactly one open job ("Senior Talent Acquisition Partner") and its posting exists but `is_active = false`. Every other open Virgilio job has either no posting or an inactive one — so the page legitimately renders zero results.

Three problems contribute to this and to the two issues you mentioned. The plan fixes all three.

---

## 1) Publish open postings (data + behavior)

**Data fix (one row):** set `is_active = true` on posting `ad57fc13-…` ("Senior Talent Acquisition Partner") so it appears on /virgilio-careers immediately.

**Behavior fix going forward:** a DB trigger on `jobs` keeps `job_postings.is_active` in sync with `jobs.status`:
- `status` becomes `open` → set `is_active = true` on the latest posting for that job
- `status` becomes `closed` or `archived` → set `is_active = false` on all postings for that job
- `draft` → no change (lets you stage a posting)

This removes the hidden second toggle nobody finds.

## 2) Two "Virgilio" orgs in pickers

There are two rows named "Virgilio":
- `5ba7b145-…` — `org_kind = root`, `tenant_type = saas` (the tenant itself)
- `4b8e739f-…` — `org_kind = client`, `tenant_type = internal` (the workspace container that owns jobs)

`useChildOrganizationsForJobCreation` returns `rootOrg + children`, which is why the root saas org shows up alongside the real client org. Jobs should only ever attach to `client` orgs (see memory: Departments vs Clients).

**Fix:** in that hook, drop the root row from the returned list and only return rows where `org_kind = 'client'` (or `parent_organization_id = tenant`). Result: pickers show a single "Virgilio" — the client/internal one.

## 3) Department not saved on the public posting

The wizard's `JobPostingStep.savePosting()` writes `details.department = (jobData as any)?.department ?? null`, but the wizard's `jobData` only carries `department_id`, never the `department` text. So `job_postings.details.department` is always `null` — even when a department is clearly picked — which is why the careers page groups everything under "Other" and why it looks like the department isn't being saved.

**Fix:** in `JobPostingStep.savePosting()`, resolve the department name from `department_id` (look up `departments.name` for the selected id, or pass it down from the wizard's department option list) and persist it as `details.department`. Same fix on the update path if/when the posting is edited later.

---

## Technical details

```text
1. supabase migration
   - data: UPDATE job_postings SET is_active=true WHERE id='ad57fc13-…'
   - trigger: AFTER UPDATE OF status ON public.jobs
     · NEW.status='open'  → UPDATE job_postings SET is_active=true
                            WHERE job_id=NEW.id
                              AND id = (latest posting for job)
     · NEW.status IN ('closed','archived')
                          → UPDATE job_postings SET is_active=false
                            WHERE job_id=NEW.id

2. src/hooks/useChildOrganizationsForJobCreation.ts
   - Stop prepending rootOrg
   - Filter children to org_kind='client' AND status='active'

3. src/components/jobs/wizard/JobPostingStep.tsx
   - In savePosting(): if jobData.department_id, look up department name
     (via useDepartments cache or a one-off select) and set
     details.department = <name>
   - Same in any later posting-update path that writes details
```

No UI redesign, no schema additions — just data, one trigger, one hook filter, and a name lookup in the posting save.
