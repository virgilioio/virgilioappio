
Goal: fix inbound email body capture first (highest priority), then stop “self-sent” emails from appearing as received replies.

What I found:
1) The webhook is successfully firing and inserting rows.
2) Edge logs show this exact error during body fetch:
   - `[Candidate Reply] Resend API error: 404 {"message":"Email not found"}`
3) Current code calls:
   - `GET https://api.resend.com/emails/{emailData.email_id}`
4) For inbound/received messages, Resend uses the receiving endpoint, not the regular send-email retrieve endpoint.
   - Correct endpoint should be: `GET /emails/receiving/{email_id}`
5) The “sent email appears as received” behavior is caused by intentionally BCC’ing the ingest address. That copy is technically inbound to the ingest mailbox, so webhook logic currently treats it like a candidate reply.

What you need to do on Resend:
- No dashboard change should be required for this fix.
- Your webhook setup is already working.
- This is an endpoint/logic issue in our function code.

Implementation plan:

1) Fix body retrieval endpoint in `process-candidate-reply-webhook`
- File: `supabase/functions/process-candidate-reply-webhook/index.ts`
- Replace current fetch URL:
  - from `https://api.resend.com/emails/${emailData.email_id}`
  - to `https://api.resend.com/emails/receiving/${emailData.email_id}`
- Keep auth as `Authorization: Bearer ${RESEND_API_KEY}`.
- Parse returned `html` and `text` from the receiving payload.
- Continue storing:
  - `body_html`
  - `body_text`
  - `snippet` from text fallback.

2) Add resilient fetch behavior for inbound body retrieval
- If receiving API returns transient 404/processing states, add a short retry strategy:
  - e.g., 3 attempts with small delay (250ms/500ms/1000ms).
- Improve logging to include:
  - `email_id`
  - attempt number
  - response status.
- This prevents race-condition empties if payload arrives before content becomes available.

3) Prevent self-sent BCC copies from being logged as received candidate replies
- In `process-candidate-reply-webhook`, after association/tenant resolution and after parsing sender:
  - Query `user_mail_identities` scoped to same tenant for `email_address == parsedFrom` (case-insensitive).
  - If sender is one of our own connected mailbox identities, return:
    - `{ status: 'ignored', reason: 'internal_sender_copy' }`
- This will stop the annoying “I sent it, then it appears as received” duplicate behavior without weakening reply ingestion.

4) Keep reply ingestion intact for real candidate replies
- Do not remove ingest routing.
- Keep token matching logic (`jc_...@ingest.gogio.io`) as-is.
- Keep duplicate guard by `rfc822_message_id`.
- Only suppress inbound events identified as internal mailbox echoes.

5) Validation checklist after implementation
- Test A (body capture):
  1. Send a candidate reply to ingest address.
  2. Confirm edge logs show successful call to `/emails/receiving/{id}`.
  3. Confirm email history shows real content (not “No content”).
- Test B (self-copy suppression):
  1. Send a brand-new outbound email from app.
  2. Confirm no extra “received” item gets created from your own sender address.
- Test C (no regression):
  1. Reply normally from candidate mailbox.
  2. Confirm thread continues and inbound message appears once with body.

Technical notes:
- Primary files:
  - `supabase/functions/process-candidate-reply-webhook/index.ts` (main fix)
- No DB migration required.
- No new secrets required (uses existing `RESEND_API_KEY`).
- This approach addresses both issues while prioritizing body ingestion exactly as requested.
