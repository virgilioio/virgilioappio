

# Fix: Candidate Reply Webhook - "No org member found"

## Root Cause (confirmed with live data)

The webhook fails at Step 3 (line 304-308) because it queries the `members` table with:

```
.eq('organization_id', orgId)   -- orgId = job's organization_id (job folder)
```

But `members.organization_id` stores the **tenant** ID, not the job folder ID. The job folder `4b8e739f-...` has zero members. The actual members live under tenant `5ba7b145-...`.

This is a **field mismatch bug**, not a missing-member problem. But per your requirements, we should also stop requiring a member at all.

## The Problem with `user_id`

`email_logs.user_id` is `NOT NULL`. The webhook currently needs a member lookup solely to populate this required field. For inbound emails from external candidates, there is no meaningful "user" -- it's a system-ingested record.

## Plan

### Step 1: Database Migration

Make `email_logs.user_id` nullable so inbound webhook emails don't need a fake user attribution:

```sql
ALTER TABLE email_logs ALTER COLUMN user_id DROP NOT NULL;
```

### Step 2: Rewrite the webhook (process-candidate-reply-webhook/index.ts)

Remove the entire "Step 3: Find an active org member" block (lines 301-328). Replace the `user_id` in the insert payload with `null`.

Keep everything else the same -- the association lookup already works correctly and provides `tenant_id`, `organization_id`, `candidate_id`, `job_id`.

Also fix error handling per requirements:
- Association not found: return **200** with `{ status: "ignored", reason: "unmatched_token" }` (not 404)
- Remove the `tenantId || orgId` guard that returns 400
- Activity logging: skip `log_activity` RPC when no `user_id` is available (it likely requires one)

### Step 3: Deploy

The edge function auto-deploys on save.

## Changes Summary

```text
File                                              Change
------------------------------------------------  ----------------------------------------
migration (new)                                   user_id DROP NOT NULL on email_logs
process-candidate-reply-webhook/index.ts          Remove member lookup (lines 301-328)
                                                  Set user_id: null in insert payload
                                                  Return 200 for unmatched tokens
                                                  Skip activity log when no user_id
```

## What This Does NOT Change

- The ingest code extraction logic (already working -- logs confirm `yd03np7c` found)
- The association lookup (already working -- logs confirm candidate/job found)
- The signature verification, dedup, threading logic
- The Gmail sync edge function (separate concern)
- Frontend `useEmailLogs` hook (already queries by `candidate_id` + `job_id`, no `user_id` filter)

