

# Fix WhatsApp Inbound Message Routing

## Problem
The inbound webhook has **zero logs** — Twilio never calls it. The root cause:

- During provisioning, the webhook URL is set as `SmsUrl` on the **phone number** (line 157 of `provision-whatsapp-number/index.ts`)
- But WhatsApp messages are sent/received via the **Twilio Messaging Service** (the number was added to it in Step 4)
- Inbound WhatsApp messages are routed through the Messaging Service's `InboundRequestUrl`, NOT the number's `SmsUrl`
- Since the Messaging Service has no `InboundRequestUrl` configured, Twilio silently drops inbound replies

## Fix

### 1. `supabase/functions/provision-whatsapp-number/index.ts`

After Step 4 (registering the number with the Messaging Service), add a **new Step 4b**: configure the Messaging Service's `InboundRequestUrl` to point to the inbound webhook.

```typescript
// Step 4b: Configure Messaging Service inbound webhook
const msgServiceResponse = await fetch(
  `https://messaging.twilio.com/v1/Services/${MESSAGING_SERVICE_SID}`,
  {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      InboundRequestUrl: `${supabaseUrl}/functions/v1/whatsapp-inbound-webhook`,
      InboundMethod: "POST",
    }),
  }
);
```

This uses the same Twilio master credentials already available for the Sender registration step.

### 2. One-time manual fix for current setup

Since the number is already provisioned, the provisioning code won't re-run. We need a way to apply this fix to the existing Messaging Service. Two options:

**Option A (recommended):** Add the Messaging Service webhook config call to the `whatsapp-inbound-webhook` function itself as a self-healing check on first call — too complex.

**Option B (simpler):** Create a small utility edge function `fix-whatsapp-webhook` that configures the Messaging Service `InboundRequestUrl` when called once. After it runs, it can be deleted.

I'll go with Option B — a one-shot edge function you invoke once to fix the existing setup, plus the permanent fix in provisioning for future setups.

### 3. `supabase/functions/fix-whatsapp-webhook/index.ts` (new, temporary)

A simple authenticated function that:
1. Reads `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` from env
2. Calls `POST https://messaging.twilio.com/v1/Services/{SID}` with `InboundRequestUrl` set to the webhook
3. Returns success/failure

You call it once from the browser console or via curl, then we can delete it.

## Files

| File | Change |
|---|---|
| `supabase/functions/provision-whatsapp-number/index.ts` | Add Step 4b: configure Messaging Service `InboundRequestUrl` after sender registration |
| `supabase/functions/fix-whatsapp-webhook/index.ts` | New temporary function to fix existing Messaging Service config |

