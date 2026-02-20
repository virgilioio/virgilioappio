
## Root Cause: Database Trigger Fires on Candidate Insert

### What Is Happening

When a new candidate is inserted into the `candidates` table, a database trigger fires that tries to log an activity record. The `activities` table has `user_id NOT NULL` with no default value. Since public applicants are not authenticated users, `user_id` is null — violating the constraint and crashing the entire application submission with a 500.

The edge function log confirms this exactly:

```
Error inserting global candidate: {
  code: "23502",
  message: 'null value in column "user_id" of relation "activities" violates not-null constraint'
}
```

This was always present but hidden by the earlier crashes. Now that those are fixed, this is the only remaining failure path.

### Two Possible Fixes

**Option A (preferred): Fix the trigger to handle null user_id gracefully**

The activity-logging trigger should simply skip logging (or use a placeholder) when `user_id` is null. This is the cleanest fix — it makes the trigger safe for all service-role inserts, not just public applications.

```sql
-- In the trigger function, add a guard:
IF NEW.user_id IS NULL THEN
  RETURN NEW; -- Skip activity logging for service-role inserts
END IF;
```

**Option B: Make user_id nullable in activities table**

Change `user_id` to allow NULL so service-role operations don't crash. Requires a migration and updating any queries that assume user_id is always present.

Option A is strongly preferred — it's a 1-line trigger fix with zero schema changes.

### What Needs to Be Found First

The trigger function needs to be located. Since `information_schema.triggers` returned empty (RLS hides them from that view), the trigger will be found via `pg_trigger` / `pg_proc` directly in the migration SQL.

### Fix Plan

**Step 1: Find and patch the trigger**

Run this SQL to find the trigger on `candidates`:

```sql
SELECT t.tgname, p.proname, p.prosrc
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'candidates'
AND NOT t.tgisinternal;
```

Then patch the trigger function to guard against null `user_id`:

```sql
CREATE OR REPLACE FUNCTION <trigger_function_name>()
RETURNS trigger AS $$
BEGIN
  -- Guard: skip activity logging when there's no authenticated user (e.g. service-role inserts from public applications)
  IF NEW.user_id IS NULL OR (SELECT current_setting('request.jwt.claims', true)::jsonb->>'sub') IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- existing activity insert logic...
  INSERT INTO activities (user_id, ...)
  VALUES (...);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 2: Verify edge function error handling**

After the trigger fix, the `globalInsertErr` path on line 266 of the edge function will no longer be hit for new candidates. As a defensive measure, add a log to confirm new candidates are created successfully.

### Files/Objects Modified

| Object | Change |
|--------|--------|
| Database trigger function on `candidates` | Add null `user_id` guard — skip activity log for service-role inserts |
| `supabase/functions/public-submit-application/index.ts` | No changes needed — the error handling there is already correct |

### What This Does NOT Require

- No schema changes to `activities` or `candidates`
- No edge function redeployment (the fix is purely in the database trigger)
- No RLS policy changes

### Why This Is the Last Remaining Issue

Going through the complete failure history:
1. ~~Duplicate association unique constraint crash~~ — fixed (check-before-insert guard)
2. ~~`check_application_limits` hard 500~~ — fixed (non-blocking soft warning)
3. **Activity trigger null `user_id` crash** — this fix

After this, both new and returning candidates will be able to apply without any 500 errors.
