

# Fix Candidate Email Reply Capture

## Problem

Candidate replies to emails sent through GoGio never appear in the platform. Three issues compound:

1. The ingest address (`jc_xxx@ingest.gogio.io`) is added as **BCC**, which only delivers the outbound email -- replies from candidates never reach it
2. Resend inbound webhooks appear unconfigured (zero logs ever)
3. Gmail sync (the backup path) is failing with OAuth token errors

## How Greenhouse/Ashby/Lever Solve This

They use a **Reply-To header** containing both the recruiter's address AND a unique ingest address. When the candidate replies, the reply goes to both destinations -- the recruiter sees it in Gmail and the platform captures it via webhook.

## Solution

### Change 1: Add Reply-To Header with Dual Addresses

**File:** `supabase/functions/send-user-email/index.ts`

In the `buildRFC822Email` function (around line 74), add a `Reply-To` header that includes BOTH the sender's address and the ingest address. This ensures:
- Candidate replies land in the recruiter's Gmail (natural behavior preserved)
- Candidate replies also go to `jc_xxx@ingest.gogio.io` (captured by webhook)

The change is in the RFC822 email builder -- add a new optional `replyTo` parameter:

```
Reply-To: recruiter@company.com, jc_xxx@ingest.gogio.io
```

Then pass the ingest email into the builder call at line ~894 where the email is constructed.

### Change 2: Pass Ingest Email Through to the Email Builder

**File:** `supabase/functions/send-user-email/index.ts`

Currently, the ingest email is added to BCC (lines 879-891). Instead:
- Keep the BCC addition (for outbound email logging at the ingest address -- useful for record-keeping)
- ALSO pass the ingest email to `buildRFC822Email` so it's included in the Reply-To header
- Modify `buildRFC822Email` signature to accept an optional `replyToAddresses` parameter

The updated builder will output:
```
From: recruiter@company.com
To: candidate@gmail.com
Reply-To: recruiter@company.com, jc_xxx@ingest.gogio.io
```

### Change 3: Update process-candidate-reply-webhook to Check All Address Fields

**File:** `supabase/functions/process-candidate-reply-webhook/index.ts`

The webhook currently only checks `to` and `cc` for the `jc_` ingest code. When candidates reply, the ingest address might appear in:
- `to` (if Reply-To had both addresses and client uses the first)
- `cc` (less likely)
- The full recipient list from Resend's envelope

Update `findCandidateIngestCode` to also check the `bcc` field and the raw envelope recipients, making the matching more robust.

### Change 4: Handle Email Threading in the Webhook

**File:** `supabase/functions/process-candidate-reply-webhook/index.ts`

Currently the webhook logs the received email but doesn't capture threading information. Add:
- Extract `In-Reply-To` and `References` headers from the incoming email data
- Look up the original sent email's `thread_id` and `provider_message_id` from `email_logs`
- Store these on the received email log for proper thread grouping in the UI

This makes the reply appear in the same conversation thread as the original email.

---

## Infrastructure Setup Required (Manual Steps)

These are configuration steps in Resend's dashboard that cannot be done via code:

1. **Verify MX records** for `ingest.gogio.io` point to Resend's inbound servers
2. **Create/verify an inbound webhook** in Resend dashboard:
   - Domain: `ingest.gogio.io`
   - Webhook URL: `https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/process-candidate-reply-webhook`
   - Events: `email.received`
3. **Test the webhook** by sending a test email to any `@ingest.gogio.io` address and checking edge function logs

---

## Summary of Code Changes

| File | Change |
|------|--------|
| `supabase/functions/send-user-email/index.ts` | Add `Reply-To` header with sender + ingest addresses in `buildRFC822Email`; pass ingest email through to builder |
| `supabase/functions/process-candidate-reply-webhook/index.ts` | Check all address fields for ingest code; add email threading (In-Reply-To, References, thread_id) |

## What This Achieves

- Candidate replies to any email sent through GoGio will be captured in near-real-time
- The reply appears in the candidate's email thread in the platform
- The recruiter still sees the reply in their Gmail inbox naturally
- Activity feed shows "Reply received" with the email content
- No changes needed to the frontend -- `useEmailLogs` already queries by `candidate_id` and has Realtime subscriptions

## Risk Assessment

- **Low risk**: Reply-To is a standard RFC 2822 header, supported by all email clients
- **Low risk**: Adding a second Reply-To address is well-supported (Gmail, Outlook, Apple Mail all handle it)
- **Note**: Some candidates may notice the extra address in their reply. This is the same as Greenhouse/Ashby -- it's industry standard and candidates are accustomed to it

