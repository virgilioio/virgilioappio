# Only open jobs appear on the public careers page

Two coupled fixes so the careers page reflects reality:

## 1. DB trigger: auto-deactivate postings when a job leaves `open`

`AFTER UPDATE OF status ON public.jobs` (SECURITY DEFINER):
- If `NEW.status <> 'open'` and was `'open'` → set `job_postings.is_active = false` for that job.
- If `NEW.status = 'open'` and was not → leave postings as-is (do **not** auto-reopen; reopening should be an explicit user action to avoid surprise publishing).

## 2. One-shot backfill

```sql
UPDATE public.job_postings p
SET is_active = false
FROM public.jobs j
WHERE p.job_id = j.id
  AND j.status <> 'open'
  AND p.is_active = true;
```

Closes every dangling posting attached to non-open jobs.

## 3. Public careers page hardening (`PublicCareersPage.tsx`)

The query already filters `is_active = true`, but that's only true going forward thanks to the trigger. Add a belt-and-braces inner join filter so even if a posting slips through, it never renders:

- Switch the postings query to `select(..., jobs!inner(status)).eq('jobs.status', 'open')`.
- Apply the same guard on `PublicJobPosting.tsx` (single-posting page) — return 404 if the parent job isn't `open` or the posting is `is_active = false`.

## 4. Client cache invalidation

In `useJobs.updateJob` / `archiveJob`, after a status change away from `open`, call `queryClient.invalidateQueries({ queryKey: ['job-postings'] })` so the internal posting list reflects the auto-off immediately.

## Files touched

- New migration: trigger + backfill (sections 1 & 2)
- `src/pages/PublicCareersPage.tsx` — inner-join status filter
- `src/pages/PublicJobPosting.tsx` — guard against non-open parent
- `src/hooks/useJobs.ts` — invalidate postings cache on status change

## Out of scope

- Auto-reopening postings when a job is reopened (left as explicit user action).
- UI changes inside the internal posting editor (it already shows `is_active` toggle).
