## Root cause

Saving a completed scorecard inserts into `public.job_stage_scorecards`. That insert fires the database trigger `public.tg_notify_scorecard_submitted()`, which still tries to read candidate name as `c.first_name` / `c.last_name`.

The current `public.candidates` schema does not have those columns; it uses `candidate_name`. Postgres therefore aborts the insert with:

```text
column c.first_name does not exist
```

That rollback is why the scorecard cannot save.

## Plan

1. **Replace the stale notification trigger function**
   - Update `public.tg_notify_scorecard_submitted()` to read `c.candidate_name` instead of `c.first_name` / `c.last_name`.
   - Keep the existing behavior: only notify for real submitted scorecards, not AI drafts or unrated saves.
   - Keep the existing notification target: job creator, skipping the person who submitted the scorecard.

2. **Make the trigger resilient to the current scorecard schema**
   - Use the `job_stage_scorecards` row’s existing `candidate_id`, `job_id`, `created_by`, `rating`, and `id` fields.
   - Use `candidate.tenant_id` when present, falling back to `candidate.organization_id` so notifications still attach to the correct tenant/org context.
   - Build notification title text using `candidate_name`.

3. **Run the migration through Supabase**
   - This is a database function/trigger fix, so it must be applied with the Supabase migration tool.
   - No frontend restyle or scorecard sheet UI changes are needed.
   - No table schema changes are needed.

4. **Verify after migration**
   - Re-check recent Postgres errors for `column c.first_name does not exist`.
   - Try saving a completed scorecard again.
   - Confirm the saved scorecard row can be returned to the app and then appears in the Job Overview scorecards card and the Scorecards tab card via the refresh fix already implemented.