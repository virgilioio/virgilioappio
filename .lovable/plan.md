## Root cause

`src/components/jobs/JobFormSheet.tsx` line 96 strips `organization_id` from the payload whenever editing an existing job:

```ts
if (job) delete src.organization_id
```

So when you change the Client dropdown and hit Save:
- The Client (`organization_id`) is never sent → DB row keeps the old client → Jobs table still shows the old company.
- Because `useJobs.updateJob` denormalizes the department NAME from `department_id` into the legacy `jobs.department` text column, that part appears to work — but the table column you're looking at ("Client") is the company name from `organizations`, which never changed.
- On re-opening the sheet, the form hydrates from the unchanged `job.organization_id`. If the persisted org no longer matches a child-client option in the dropdown (e.g. you'd selected a different client and the cached `jobs` query is stale), `SearchableSelect` falls back to its placeholder — that's the "empty" you're seeing.

`department_id` is in fact included in the patch and persists to the row, so the same one-line removal is enough to make both fields round-trip correctly.

## Fix

Single, surgical edit in `src/components/jobs/JobFormSheet.tsx`:

1. Remove line 96 (`if (job) delete src.organization_id`).
2. Always include `organization_id` in the update payload when the field is set: change line 129's create-only branch to `if (src.organization_id) payload.organization_id = src.organization_id` — this covers both create and edit.

That's it. No schema changes, no hook changes, no UI restructuring. `useJobs.updateJob` already spreads `organization_id` through the patch, the column is updateable, and RLS allows owners of the tenant to update jobs within the tenant.

## Verification (after the change)

1. Open a job → Edit → switch Client to a different client → switch Department → Save.
2. Re-open Edit on the same job: both Client and Department dropdowns show the new selections, not the old ones and not empty.
3. Jobs list table reflects the new Client in the Company/Client column (after the `['jobs']` query refetch that `updateJob` already triggers).
4. Run a quick `select id, organization_id, department_id, department from jobs where id = '<edited job id>'` via the read-query tool to confirm both columns were updated.

## Out of scope

- No changes to the Jobs table column rendering, the wizard, or any other form.
- No changes to RLS, denormalization, or the `department` legacy text column behavior.
- No new fields, no new validation rules.
