

# Single Webhook Router: Forward `int_` emails to transcript handler

## Problem
Resend is only delivering inbound emails to the `process-candidate-reply-webhook` endpoint. The `process-transcript-webhook` never gets called directly. This is likely a Resend platform behavior where only one webhook fires per inbound email event.

## Solution
Add routing logic to `process-candidate-reply-webhook` so that when it detects an `int_` ingest code (instead of `jc_`), it forwards the raw payload to `process-transcript-webhook` via an internal HTTP call.

## Changes

**File: `supabase/functions/process-candidate-reply-webhook/index.ts`**

1. Add a helper function `findTranscriptIngestCode()` that checks recipients for `int_` prefixed addresses (mirrors the existing `findCandidateIngestCode` but for `int_` prefix)

2. In the main handler, right after the "No jc_ code found" check (line ~278-283), before returning the "ignored" response:
   - Call `findTranscriptIngestCode(emailData)`
   - If an `int_` code is found, forward the original raw payload to `${supabaseUrl}/functions/v1/process-transcript-webhook` using `fetch()` with the service role key
   - Log the forwarding action and return the transcript webhook's response
   - If no `int_` code either, return the existing "ignored" response

3. The forwarding call passes the raw JSON payload as-is (no Svix headers needed since the transcript webhook already handles missing signatures)

## Key code flow
```text
Resend → candidate-reply-webhook
  ├─ has jc_ code? → process candidate reply (existing logic)
  ├─ has int_ code? → forward to process-transcript-webhook → return its response
  └─ neither? → return ignored (existing logic)
```

## Why this works
- The transcript webhook already accepts payloads without Svix headers (we just fixed that)
- The forwarding uses the service role key for auth
- No changes needed to `process-transcript-webhook` itself
- No Resend configuration changes needed

