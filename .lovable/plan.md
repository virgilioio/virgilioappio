

# Automate WhatsApp Provisioning: Zero-Touch Onboarding

## Problem
3 manual steps per new customer = not scalable. Let's fix each one.

## Analysis: What's Actually Manual vs. Automatable

| Step | Current | Can Automate? | How |
|------|---------|--------------|-----|
| Buy number | ✅ Automated | Already done | Gateway `POST /IncomingPhoneNumbers.json` |
| Set webhook URL | ❌ Manual | **Yes** | Gateway `POST /IncomingPhoneNumbers/{SID}.json` with `SmsUrl` — standard REST |
| Create templates | ❌ Manual per-tenant | **Not needed per-tenant** | Templates are WABA-level. Create once, all numbers use them |
| Register WhatsApp Sender | ❌ Manual | **Partially** — needs Twilio credentials stored as secrets | `POST` to `messaging.twilio.com` (different base URL, gateway can't reach it) |

## The Plan

### Step 1: Auto-configure webhook URL during provisioning
After buying the number, immediately call:
```
POST /IncomingPhoneNumbers/{SID}.json
  SmsUrl=https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/whatsapp-inbound-webhook
```
This IS a standard REST endpoint — the gateway supports it. Add this to `provision-whatsapp-number/index.ts` right after the purchase step.

**This eliminates manual step 3 entirely.**

### Step 2: Auto-register number as WhatsApp Sender
This requires the Messaging Service API (`messaging.twilio.com/v1/Services/{ServiceSid}/PhoneNumbers`), which the gateway can't reach. Two options:

**Option A — Store Twilio credentials directly**: Add `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` as Supabase edge function secrets. Call Twilio's Messaging Service API directly (bypassing gateway) to add the number to GoGio's pre-configured Messaging Service.

**Option B — Gateway-only**: If we can't store direct credentials, this step stays manual. But it's a single API call in Twilio Console per number.

I recommend **Option A** — storing the master credentials as secrets is standard for ISV platforms and eliminates the last manual per-tenant step.

### Step 3: Templates are already solved
Templates are WABA-level. GoGio creates them once in Twilio Console. They're already seeded in the DB. No per-tenant action needed.

## Implementation

### File: `supabase/functions/provision-whatsapp-number/index.ts`
After the existing purchase step (line 142), add two new steps:

**New Step 3**: Configure webhook URL on the purchased number
```typescript
// POST /IncomingPhoneNumbers/{phoneSid}.json via gateway
await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers/${phoneSid}.json`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": TWILIO_API_KEY,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    SmsUrl: `${supabaseUrl}/functions/v1/whatsapp-inbound-webhook`,
    SmsMethod: "POST",
  }),
});
```

**New Step 4** (if Option A approved): Register as WhatsApp Sender via direct Twilio API
```typescript
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

await fetch(
  `https://messaging.twilio.com/v1/Services/${MESSAGING_SERVICE_SID}/PhoneNumbers`,
  {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ PhoneNumberSid: phoneSid }),
  }
);
```

### Secrets needed (for Option A)
- `TWILIO_ACCOUNT_SID` — GoGio's master account SID
- `TWILIO_AUTH_TOKEN` — GoGio's master auth token  
- `TWILIO_MESSAGING_SERVICE_SID` — the pre-configured Messaging Service with WhatsApp enabled

### One-time prerequisites (GoGio team, done ONCE ever)
1. Get WhatsApp Business Account approved in Twilio Console
2. Create a Messaging Service and enable WhatsApp on it
3. Create Content templates under the WABA (already seeded in DB)
4. Store the 3 secrets above in Supabase edge function settings

### Per-tenant flow after implementation
Customer clicks "Enable WhatsApp" → system automatically:
1. Buys a number ✅ (already works)
2. Sets webhook URL on it ✅ (new)
3. Adds number to Messaging Service as WhatsApp Sender ✅ (new, Option A)
4. Saves config to DB ✅ (already works)

**Zero manual steps per customer.**

## Files to change

| File | Change |
|------|--------|
| `supabase/functions/provision-whatsapp-number/index.ts` | Add webhook config + WhatsApp Sender registration after purchase |

