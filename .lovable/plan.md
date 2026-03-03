

# Fix: Make Transcript Webhook Handle Missing Svix Headers

## Problem

Resend IS calling the transcript webhook, but the request arrives without Svix signature headers (`svix-id`, `svix-timestamp`, `svix-signature` are all missing). The current code rejects these requests with 401.

The candidate reply webhook receives Svix headers because it may use a different Resend webhook type or configuration. This is a known limitation noted in the project memory: "Due to limitations in Resend's inbound email webhooks regarding Svix signature headers, the function implements optional signature verification."

## Fix

**File: `supabase/functions/process-transcript-webhook/index.ts`**

Change the signature verification block to be **optional**:
- If Svix headers are present → verify signature (reject if invalid)
- If Svix headers are missing → skip verification, parse payload directly, log a warning
- The rest of the processing remains unchanged — the ingest code validation (`int_` prefix + booking lookup) provides sufficient security

This matches how the code was originally intended to work per the project memory.

## Security Note

Even without signature verification, the webhook is protected by:
1. The `int_{code}` ingest code must match a valid booking in the database
2. The booking must have a candidate and job hiring stage
3. The transcript content must be at least 100 characters

No other files need to change.

