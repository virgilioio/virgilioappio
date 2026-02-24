

# Fix: Fetch email body content for received candidate replies

## Problem

Resend's `email.received` webhook only delivers metadata (from, to, subject, email_id, attachments). It does **not** include the email body (`html` or `text`). That's why every received email shows "No content."

The current webhook code reads `emailData.text` and `emailData.html`, but those fields simply don't exist in the webhook payload.

## Solution

After processing the webhook event, make a follow-up API call to Resend to retrieve the full email content:

```
GET https://api.resend.com/emails/{email_id}
Authorization: Bearer RESEND_API_KEY
```

This returns the full email object including `html` and `text` fields.

## Changes

**File: `supabase/functions/process-candidate-reply-webhook/index.ts`**

After the association lookup and before the email_logs insert, add a step to fetch the full email content:

1. Use the `email_id` from `emailData.email_id` (already present in the webhook payload)
2. Call `GET https://api.resend.com/emails/{email_id}` with `RESEND_API_KEY` (already configured as a secret and used by other edge functions)
3. Extract `html` and `text` from the API response
4. Use those values in the `email_logs` insert for `body_html`, `body_text`, and `snippet`

The new step (inserted between the threading lookup and the email_logs insert):

```typescript
// Fetch full email content from Resend API
let bodyHtml: string | null = null;
let bodyText: string | null = null;

const resendApiKey = Deno.env.get('RESEND_API_KEY');
if (resendApiKey && emailData.email_id) {
  try {
    const emailRes = await fetch(
      `https://api.resend.com/emails/${emailData.email_id}`,
      { headers: { Authorization: `Bearer ${resendApiKey}` } }
    );
    if (emailRes.ok) {
      const fullEmail = await emailRes.json();
      bodyHtml = fullEmail.html || null;
      bodyText = fullEmail.text || null;
      console.log('[Candidate Reply] Fetched email body:',
        bodyHtml ? `html=${bodyHtml.length}chars` : 'no html',
        bodyText ? `text=${bodyText.length}chars` : 'no text');
    } else {
      console.error('[Candidate Reply] Resend API error:',
        emailRes.status, await emailRes.text());
    }
  } catch (err) {
    console.error('[Candidate Reply] Failed to fetch email body:', err);
  }
}
```

Then update the insert payload to use `bodyHtml`/`bodyText` instead of `emailData.html`/`emailData.text`:

```typescript
body_text: bodyText || emailData.text || null,
body_html: bodyHtml || emailData.html || null,
snippet: (bodyText || emailData.text)?.substring(0, 200) || null,
```

## No new secrets needed

`RESEND_API_KEY` is already configured and used by multiple other edge functions (send-invitation, send-confirmation-email, etc.).

## Files Changed

```text
supabase/functions/process-candidate-reply-webhook/index.ts
  - Add Resend API fetch step after threading, before insert
  - Update insert payload to use fetched body content
```

## Test Plan

1. Send a reply to `jc_yd03np7c@ingest.gogio.io`
2. Verify webhook logs show "Fetched email body: html=Xchars"
3. Open candidate profile and confirm the reply content is visible (not "No content")

