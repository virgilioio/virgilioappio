

# Transcript Webhook — Verification and Fixes

## Current Status

The webhook is deployed and reachable, but has **never been invoked** by Resend. The most likely cause is a **signing secret mismatch** — the secret stored in Supabase (`RESEND_INBOUND_WEBHOOK_SECRET`) may not match what Resend shows (`whsec_xt/dxwhRpEHWVjDQcASPgJd4Asa7388q`).

## Action Items

### 1. Re-set the webhook signing secret
Update `RESEND_INBOUND_WEBHOOK_SECRET` to match the exact value from Resend: `whsec_xt/dxwhRpEHWVjDQcASPgJd4Asa7388q`. Since we can't read the current value, we should overwrite it to be sure.

### 2. Update AI model in `generate-scorecard-from-transcript`
- Change `gpt-4o-mini` → `gpt-4.1-mini` (current recommended model)
- Change `max_tokens` → `max_completion_tokens` (deprecated parameter)

### 3. Test the pipeline
After updating the secret, send a test email to one of the existing ingest addresses (e.g., `int_spozjwih@ingest.gogio.io`) and monitor the edge function logs to confirm the full flow: webhook received → transcript stored → scorecard generated → notification emailed.

## Files to Change

- **`supabase/functions/generate-scorecard-from-transcript/index.ts`** — Update model and parameter name (2 lines)

## What Won't Change

- `process-transcript-webhook/index.ts` — The webhook handler code is correct. The issue is the secret configuration, not the code.
- Candidate reply webhook (`jc_` prefix) — untouched as requested.

