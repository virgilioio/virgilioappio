
## What’s actually happening (confirmed root cause)

I traced the exact query keys and found a cache collision that explains your symptoms perfectly.

### Evidence from code
- `src/pages/JobDetail.tsx` uses:
  - `useQuery({ queryKey: ['job', id], ... })`
  - This query fetches **full job details** (`select('*', organization:organizations(...))`) and is used for:
    - page header title (`job.title`)
    - Job Setup overview fields (description, location, salary, etc.)

- `src/components/jobs/StageConfigSheet.tsx` also uses:
  - `useQuery({ queryKey: ['job', jobId], ... })`
  - But this one fetches only:
    - `select('organization_id')`

- `HiringPlanTab` always renders `<StageConfigSheet ... jobId={jobId} />` even when the sheet is closed.
- So when you enter **Job Setup > Hiring Plan**, `StageConfigSheet` mounts and runs its query, writing a **partial job object** into the same React Query cache key `['job', jobId]`.

### Why UI breaks exactly the way you reported
Once the partial payload `{ organization_id: ... }` overwrites the full cache entry:
- `job.title` becomes `undefined` → top job title disappears
- most fields used in Overview become `undefined` / nullish → fallback text like **“Not specified”**
- this is deterministic and matches your exact repro path

The previous `staleTime + placeholderData` change in `JobDetail.tsx` cannot fix this, because that was treating refetch flicker, not **same-key data shape overwrite** from another component.

---

## Implementation plan to fix it safely

### 1) Stop the cache key collision in `StageConfigSheet`
**File:** `src/components/jobs/StageConfigSheet.tsx`

Change the query key from:
- `['job', jobId]`

To a distinct key, for example:
- `['job-org-context', jobId]` (or `['job', jobId, 'organization_id']`)

This ensures it never overwrites the detail page’s full job cache.

### 2) Prevent unnecessary fetch when sheet is closed
In the same query, change `enabled` from:
- `enabled: !!jobId`

To:
- `enabled: open && !!jobId`

Because organization_id is only needed inside the config sheet tabs, there’s no reason to fetch when the sheet isn’t open. This also reduces background noise and avoids side effects on tab navigation.

### 3) Keep the `JobDetail` resilience guard
**File:** `src/pages/JobDetail.tsx`

Keep the already added defensive config (`staleTime`, `placeholderData`, skeleton for `!job`)—it’s still useful for UX.
No rollback needed; it just wasn’t sufficient by itself.

### 4) Validate no other shared `['job', ...]` partial queries exist
I already searched and found only these two occurrences:
- `JobDetail.tsx` (full shape)
- `StageConfigSheet.tsx` (partial shape)

So this single collision fix should eliminate the bug.

---

## Verification steps after patch

1. Open `/jobs/:id`
2. Go to **Job Setup > Hiring Plan**
3. Confirm top header still shows the job title
4. Switch back to **Overview**
5. Confirm description, location, salary, department/team values remain populated
6. Open **Configure Stage** sheet and check Team/Automations still receive `organization_id` correctly

Optional dev check:
- inspect React Query DevTools cache:
  - `['job', id]` should always contain full job object
  - `['job-org-context', id]` should contain only org context payload

---

## Technical summary

```text
Current bug source:
  JobDetail query key      ['job', id] -> full job payload
  StageConfigSheet key     ['job', jobId] -> { organization_id } only
  => same key, incompatible payload shapes, cache overwrite

Fix:
  StageConfigSheet key     ['job-org-context', jobId]
  + enabled: open && !!jobId
```

This is the direct reason the title disappears and Overview shows “Not specified.”
