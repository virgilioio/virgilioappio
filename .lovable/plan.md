

# Fix: Gmail Sync Failing Due to NULL organization_id

## The Real Problem

You're right -- `organization_id` in this context means "job folder," NOT tenant. The `user_mail_identities` table correctly only has `tenant_id` (no `organization_id`), because email accounts belong to the tenant/workspace, not to a specific job folder.

The edge function sets `organization_id: identity.organization_id`, but that field doesn't exist on `user_mail_identities`, so it's always `undefined`. The `email_logs` table has `organization_id` as NOT NULL, causing every upsert to fail with a constraint violation.

## The Fix

### Step 1: Database Migration -- Make organization_id nullable on email_logs

Synced emails don't necessarily belong to a specific job folder at sync time. The `organization_id` can be populated later when the email is matched to a candidate (who belongs to a job folder). Making it nullable is the correct approach.

```sql
ALTER TABLE email_logs
  ALTER COLUMN organization_id DROP NOT NULL;
```

### Step 2: Edge Function Update -- Remove the broken reference

In `supabase/functions/sync-gmail-messages/index.ts`, remove the reference to `identity.organization_id` (which doesn't exist) and stop setting `organization_id` in the email upsert. The `tenant_id` from the identity is sufficient for isolation. If a candidate match is found, the candidate's `organization_id` can optionally be applied.

Changes:
- Remove `organization_id: identity.organization_id` from the emailData object (line 376)
- In the candidate matching section, when a candidate is found, also copy their `organization_id` to the email log
- Remove `identity.organization_id` from `findCandidateByEmails` calls (it was always undefined anyway)

### Step 3: Data fix -- Reset historyId to force re-sync

Use the data tool to set `history_id = NULL` on the `allan@virgilio.tech` identity so the next sync does a full 7-day pull and catches the missed reply.

## Summary

```text
Root Cause                          Fix
----------------------------------  ----------------------------------
identity.organization_id is         Make email_logs.organization_id
undefined (field doesn't exist      nullable, remove broken reference
on user_mail_identities)            from edge function

historyId already past the          Reset history_id to NULL to
reply timestamp                     force full re-sync
```

Two changes: one DB migration (make column nullable), one edge function update (remove nonexistent field reference), one data update (reset historyId).
