

# Fix: Inbound Email Sync is Silently Failing

## What I Found

There are **two critical bugs** preventing inbound emails from appearing, plus an architectural gap.

### Bug 1 (CRITICAL): Gmail Sync Upsert is Silently Failing

The Postgres logs show this error repeating every sync cycle:
```
ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

The `sync-gmail-messages` function tries to upsert with:
```js
onConflict: 'mail_identity_id,provider_message_id'
```

But the unique index on `email_logs` is a **partial index**:
```sql
CREATE UNIQUE INDEX idx_email_logs_identity_provider_unique
  ON email_logs (mail_identity_id, provider_message_id)
  WHERE mail_identity_id IS NOT NULL AND provider_message_id IS NOT NULL;
```

Postgres's `ON CONFLICT` clause does **not work with partial unique indexes** unless the WHERE clause is specified -- and Supabase's JS client has no way to pass that. This means **every single upsert fails**, so no synced emails (sent or received) are being stored anymore. This is a silent data loss bug.

### Bug 2: Resend Webhook Not Receiving Replies

The `process-candidate-reply-webhook` edge function logs show only "shutdown" events -- no incoming webhook calls at all. The `jc_*@ingest.gogio.io` address relies on Resend's inbound email processing, which may not be configured or the MX records for `ingest.gogio.io` may not point to Resend. This is an infrastructure/DNS issue outside the codebase.

### How Other Platforms Handle This

Platforms like Greenhouse, Lever, and Ashby primarily rely on **Gmail/OAuth API sync** (exactly what you have), not inbound webhooks. The Gmail sync approach is the correct one -- it just needs to work. The Resend webhook path is a nice backup for non-Gmail providers but shouldn't be the primary mechanism.

## The Fix

### Step 1: Database Migration -- Replace Partial Index with Proper Unique Constraint

Drop the partial unique index and the redundant non-unique index, then create a proper unique constraint that Postgres's ON CONFLICT can use:

```sql
-- Drop the broken partial unique index
DROP INDEX IF EXISTS idx_email_logs_identity_provider_unique;

-- Drop the redundant non-unique index (same columns)
DROP INDEX IF EXISTS idx_email_logs_identity_provider_id;

-- Create a proper unique constraint (not partial)
-- Both columns are nullable, so NULLs won't conflict (SQL standard)
ALTER TABLE email_logs
  ADD CONSTRAINT uq_email_logs_identity_provider
  UNIQUE (mail_identity_id, provider_message_id);
```

This works because SQL treats NULL as distinct from other NULLs in unique constraints, so rows without `mail_identity_id` (e.g., from the Resend webhook path) won't conflict.

### Step 2: Edge Function Update -- `sync-gmail-messages`

No code changes needed in the edge function itself. The `onConflict: 'mail_identity_id,provider_message_id'` will start working once the proper constraint exists. The function should be redeployed to pick up any cached state.

### Step 3 (Optional): Trigger a Manual Re-sync

After the constraint fix, clicking "Refresh" in the email history should successfully sync and store the reply from `allan.rodriguez.90@gmail.com` (since it will appear in `allan@virgilio.tech`'s Gmail inbox via the History API or a fresh full sync).

## Summary

```text
Root Cause          Impact                           Fix
-----------------   -------------------------------- -------------------------
Partial unique      All Gmail sync upserts fail       Replace with proper
index on            silently -- no emails stored      UNIQUE constraint
email_logs

Resend webhook      jc_* ingest emails never arrive   Infrastructure/DNS issue
not receiving       at the webhook                    (separate from this fix)
```

One database migration, zero code changes. After this, Gmail sync will correctly store both sent and received emails.

