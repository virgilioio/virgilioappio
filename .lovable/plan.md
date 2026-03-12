

## Problem

The Twilio API is rejecting the phone number because it contains spaces: `whatsapp:+52 1 33 3325 5660`. Twilio requires E.164 format (no spaces, e.g. `whatsapp:+5213332555660`).

This happens in two places:
1. The **`to`** phone number coming from the candidate's contact info has spaces
2. Possibly the **`from`** number stored in `workspace_automations.config`

## Fix

**Edge function (`send-whatsapp/index.ts`)** -- sanitize both phone numbers by stripping all non-digit/non-plus characters before sending to Twilio:

```
// After line 109, replace the formatting logic:
const sanitize = (phone: string) => phone.replace(/[^\d+]/g, '');
const toClean = sanitize(to.startsWith("whatsapp:") ? to.slice(9) : to);
const fromClean = sanitize(fromNumber.startsWith("whatsapp:") ? fromNumber.slice(9) : fromNumber);
const toWhatsApp = `whatsapp:+${toClean.replace(/^\+/, '')}`;
const fromWhatsApp = `whatsapp:+${fromClean.replace(/^\+/, '')}`;
```

This strips spaces, dashes, parentheses, and any other formatting characters, ensuring E.164 compliance regardless of how the number was stored in the database or entered by the user.

Single file change, then redeploy the edge function.

