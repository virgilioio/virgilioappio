

# Fix: Remove 24h Scorecard Edit Window

## Database Migration

Drop the restrictive policy and replace with a simple ownership-based one:

```sql
DROP POLICY IF EXISTS "scorecards_update_24h_window" ON public.job_stage_scorecards;

CREATE POLICY "Users can update their own scorecards"
ON public.job_stage_scorecards
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR is_platform_admin())
WITH CHECK (created_by = auth.uid() OR is_platform_admin());
```

## Code Change

**`src/hooks/useScorecards.ts`** — In the update branch of `upsertMyScorecard`, handle the case where `.single()` returns no data (defensive guard against future RLS issues):

```ts
if (!data) throw new Error("Failed to update scorecard — you may not have permission to edit it.");
```

Two changes total: one migration, one line of defensive error handling.

