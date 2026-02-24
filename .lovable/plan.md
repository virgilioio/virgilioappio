

# Fix: Candidate Reply Emails Not Being Stored

## The Problem

The `process-candidate-reply-webhook` edge function IS receiving webhook calls from Resend when candidates reply (confirmed in logs -- mae.montejo@gmail.com replied multiple times). The function successfully:
- Verifies the webhook signature
- Parses the email event
- Extracts the `jc_` ingest code from recipients

But then it **crashes silently** -- zero logs appear after the ingest code extraction. No "Association not found", no "Threading:", no "Logged:", and critically, no error message either. The result: **422 sent emails in the database, 0 received emails.**

## Root Cause Analysis

The function dies between finding the ingest code (line 215) and the association query result (line 229+). There are two likely causes:

1. **The deployed function is stale** -- Lovable auto-deploys edge functions, but if a past deployment failed silently, the running version may be an older build that lacks the `tenant_id` field in the insert (which is `NOT NULL` with no default). This would cause a silent crash on insert.

2. **The `emailData.from` field is an object, not a string** -- Resend's `email.received` webhook can return `from` as either a string or an object like `"Mae Montejo <mae.montejo@gmail.com>"` or `{name: "...", address: "..."}`. The `from_address` column is `text NOT NULL`. If this fails, the entire function crashes. The same issue could apply to `to` and `cc` addresses.

3. **Unhandled crash that bypasses the try/catch** -- The single try/catch block can miss certain Deno runtime errors that terminate the process.

## The Fix

### File: `supabase/functions/process-candidate-reply-webhook/index.ts`

**1. Add granular logging at every step** -- After each database query and before each operation, log the result so we can always see exactly where things fail.

**2. Add a `parseEmailAddress` helper** -- Safely extract a string email from whatever format Resend sends (string, object with `.address`, or RFC 5322 format like `"Name <email>"`).

**3. Wrap each database operation in individual try/catch** -- Instead of one big try/catch, protect each query independently so one failure doesn't mask the location of the crash.

**4. Add defensive `tenant_id` handling** -- If tenant_id is missing, log it clearly and bail early with a meaningful message.

**5. Force redeployment** -- The code changes will trigger Lovable's auto-deploy, ensuring the latest version (with `tenant_id` support) is running.

### Technical Changes

```
process-candidate-reply-webhook/index.ts
|-- Add parseEmailAddress() helper to safely extract email strings
|-- Add logging after createClient (line ~217)
|-- Add logging after association query (line ~228)
|-- Add logging after member query (line ~256)
|-- Add logging after duplicate check (line ~279)
|-- Wrap insert in its own try/catch with detailed error logging
|-- Parse emailData.from through parseEmailAddress() before insert
|-- Parse to/cc arrays through parseEmailAddress() before insert
```

### No Other Files Change

The `useEmailLogs.ts` hook correctly queries for all emails including `direction = 'received'`. Once the webhook actually inserts the rows, they will appear automatically in the email feed. The Realtime subscription in the hook will also pick up new inserts.

