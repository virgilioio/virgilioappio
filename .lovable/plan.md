## What I found

Interview-notes ingest flows through `supabase/functions/process-transcript-webhook`. Interviewers/attendees BCC (or forward to) `int_{code}@ingest.gogio.io`; Resend inbound receives the mail and posts to that edge function; the function extracts text (body, PDF, VTT/SRT/TXT), writes `transcript_raw` / `transcript_metadata` / `transcript_received_at` on `scheduled_bookings`, then invokes `generate-scorecard-from-transcript`.

Evidence from the live project:

- **Last successful ingest: 2026-07-13.** Every past interview after that (roughly 10+ bookings between 2026-07-14 and 2026-07-17) has a valid `transcript_ingest_code` but `transcript_received_at IS NULL` and `transcript_raw IS NULL`.
- **`process-transcript-webhook` has zero invocations** in edge-function logs and in `function_edge_logs` for that URL. Resend is not calling us at all.
- The edge function code itself is unchanged and healthy: `verify_jwt = false` in `supabase/config.toml`, ingest-code regex still matches `int_{8-char}@ingest.gogio.io`, and the same address format is still stamped on new bookings by `create-booking` (`int_${code}@ingest.gogio.io`).

So the code path from "email arrives" → "we write the transcript" is fine. The break is **upstream of the function** — Resend inbound routing to `ingest.gogio.io` is no longer delivering to our webhook.

## Plan

Confirm the diagnosis, restore inbound delivery, and backfill missed interviews. No code changes yet — first we verify.

1. **Confirm Resend inbound is the failure point.**
   - In the Resend dashboard: Inbound → domain `ingest.gogio.io`. Check that the domain is still Verified, that the MX record still points at Resend, and that the inbound route/webhook destination is still `https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/process-transcript-webhook`.
   - Open Resend's inbound Events/Logs and look for messages received on/after 2026-07-14 addressed to `int_*@ingest.gogio.io`. Two possibilities:
     - **Nothing received** → MX / domain verification regressed (most likely if this coincides with recent domain work on `app.gogio.io`).
     - **Received but webhook failing** → destination URL/secret is wrong; Resend will show the failing delivery attempts.

2. **Fix the root cause based on step 1.**
   - If MX is missing/wrong: re-add the Resend inbound MX record on `ingest.gogio.io` and re-verify.
   - If the webhook destination is wrong or the signing secret rotated: repoint the inbound route to the current function URL and, if the secret changed, update `RESEND_INBOUND_WEBHOOK_SECRET` via `add_secret`. (The function already tolerates missing Svix headers, so a signature mismatch is the more likely culprit than "no headers".)

3. **Verify end-to-end.**
   - Send a test email with a small text body to `int_{code}@ingest.gogio.io` for a known booking, then check `process-transcript-webhook` logs and confirm `scheduled_bookings.transcript_received_at` populates and `generate-scorecard-from-transcript` fires.

4. **Backfill the gap (only after step 3 is green).**
   - Ingest is BCC-based, so the original transcripts should still be in each interviewer's mailbox / Google Meet transcript folder. Options, cheapest first:
     - Ask interviewers to forward the missed transcripts to the same `int_{code}@ingest.gogio.io` address — the webhook will pick them up automatically.
     - For bookings where that's impractical, no code change is needed; the `generate-scorecard-from-transcript` path can be triggered manually per booking once the raw transcript is uploaded.

## Notes / technical details

- Code paths verified: `process-transcript-webhook/index.ts` (regex, ingest-code lookup on `transcript_ingest_code`, PDF/OCR fallback, Resend-receiving-API fetch, `transcript_raw` write, downstream scorecard trigger) and `create-booking/index.ts` line 586 (address format).
- No recent regressions found in the function itself; the DB pattern (many bookings with codes, none ingested after 2026-07-13, plus **zero** inbound HTTP hits in `function_edge_logs`) is only consistent with delivery never reaching Supabase.
- I did not check the Resend dashboard from here — that's step 1 and needs your access.

Want me to proceed with step 1 by asking you to check the Resend inbound settings, or should I first read the Resend dashboard state some other way you'd prefer?
