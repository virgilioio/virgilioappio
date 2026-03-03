

# Fix: Transcript Webhook Not Extracting Email Body

## Problem
The routing is working perfectly now — the transcript webhook receives the email and finds the booking. But it fails with "Transcript content too short (received_length: 0)" because **Resend's webhook payload doesn't include the email body** (`text`/`html` fields are empty).

The candidate-reply webhook already solves this by fetching the body from Resend's receiving API (`GET /emails/receiving/{email_id}`), but the transcript webhook doesn't have this fallback.

## Fix

**File: `supabase/functions/process-transcript-webhook/index.ts`**

Add a Resend receiving API fetch fallback (same pattern as candidate-reply webhook):

1. After `extractTranscriptContent()` finds no content, check for `emailData.email_id`
2. If present, call `GET https://api.resend.com/emails/receiving/{email_id}` using the `RESEND_API_KEY` secret
3. Use a retry strategy (3 attempts with delays: 0ms, 500ms, 1500ms) since Resend may not have indexed the email yet
4. Extract `text`/`html` from the API response and re-run content extraction
5. Log the fetch results for debugging

This mirrors the existing proven pattern in `process-candidate-reply-webhook` lines 193-218.

## No other changes needed
The `RESEND_API_KEY` secret is already configured (used by the candidate-reply webhook).

