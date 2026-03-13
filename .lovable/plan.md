

# Production WhatsApp ISV Architecture: Per-Tenant Numbers

## The Reality

The Twilio connector gateway works for **standard REST API** endpoints:
- `POST /IncomingPhoneNumbers.json` — buy numbers (works, already implemented)
- `POST /Messages.json` — send messages (works, already implemented)
- `GET /AvailablePhoneNumbers/{country}/Local.json` — search numbers (works)

The gateway does **not** support:
- `content.twilio.com/v1/Content` — Content API for programmatic template creation/submission
- `POST /IncomingPhoneNumbers/{sid}.json` — configuring webhook URLs on purchased numbers

This means: number provisioning and messaging work through the gateway. Template creation and WhatsApp Sender registration must happen in Twilio Console by the GoGio team. Inbound webhooks need a publicly accessible edge function URL.

## Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                    GoGio Master Twilio Account           │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Number A │  │ Number B │  │ Number C │  ...           │
│  │Tenant ABC│  │Tenant DEF│  │Tenant GHI│               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
│       │              │              │                    │
│       ▼              ▼              ▼                    │
│              Twilio REST API                             │
│         (via connector gateway)                          │
└──────────────────────┬───────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    send-whatsapp   provision    inbound-webhook
    (outbound)      (buy number) (candidate replies)
```

Each tenant gets their own dedicated number purchased under GoGio's master account. Numbers are stored per-tenant in `workspace_automations`. Messages are isolated by `tenant_id` + `sender_id`.

## What works today vs. what needs to change

| Capability | Current State | Target State |
|---|---|---|
| Number provisioning | Buys number via gateway -- works | Keep as-is, already correct |
| Sending messages | Uses per-tenant `twilio_from_number` -- works | Keep as-is |
| Template submission to Meta | DB-only stub (TODO comment) | GoGio seeds global templates with real Content SIDs from Twilio Console |
| Inbound messages | Not implemented | New `whatsapp-inbound-webhook` edge function |
| Setup wizard | 5-step wizard with broken verify/template steps | Simplify: provision → activate (2 steps) |
| Setup status | 6 states, most unused | 3 states: `not_started`, `active`, `ready` |
| Template library UI | Shows submit/refresh buttons that don't work | Show approved templates as ready-to-use; hide non-functional submit flow |
| Chat tab gating | Blocks on `canMessage` which requires approved templates | Simplify -- block only when `not_started` or no phone number |

## Implementation Plan

### 1. New edge function: `whatsapp-inbound-webhook`
Public endpoint (no JWT) that Twilio calls when a candidate texts back. Matches `From` phone to an existing conversation, inserts message as `direction: 'inbound'`, increments `unread_count`. Must be registered manually in Twilio Console as the webhook URL for each provisioned number.

### 2. Simplify `WhatsAppSetupWizard.tsx`
Remove the `verify` and `templates` steps. Flow becomes:
- **Welcome** — explains what happens
- **Provision** — buy number (keep existing logic, it works)
- **Complete** — done, number is active

Remove the "Activate sender" step since provisioning = activation.

### 3. Simplify `useWhatsAppConfig.ts` setup status
Reduce to 3 states:
- `not_started` — no number provisioned
- `active` — number provisioned, WhatsApp enabled
- `error` — something went wrong

Remove `provisioning`, `sender_pending`, `sender_active`, `templates_required`. The `canMessage` flag is `true` when `active`.

### 4. Update `WhatsAppIntegrationCard.tsx`
- Remove template count stats (approved/pending/draft) from the main card
- Remove the template-gating logic
- Keep the "Manage Templates" expand for viewing available templates
- Simplify status badge to active/inactive/not set up

### 5. Update `WhatsAppTemplateLibrary.tsx`
- Remove the "Submit" and "Refresh" buttons (they don't work)
- Remove filter tabs for pending/rejected (irrelevant until Content API is available)
- Show global GoGio templates as "Ready to use"
- Keep "New Template" for creating local drafts (future use)
- Add note: "Custom templates require GoGio team approval"

### 6. Update `WhatsAppChatTab.tsx`
- Simplify blocking logic: only block when `status === 'not_started'` or no phone number
- Remove the `canMessage` dependency on approved templates for now
- Allow freeform messaging always (the Twilio API will enforce template rules at the API level and return clear errors)

### 7. Update `send-whatsapp/index.ts`
- Remove the `is_active` check on `workspace_automations` (if they have a number, they can send)
- Keep the existing per-tenant `twilio_from_number` logic (correct architecture)

### 8. Seed global templates via migration
Insert GoGio's standard recruiting templates into `whatsapp_templates` with `tenant_id = NULL`. Initially without `twilio_content_sid` (marked as "local only"). Once the GoGio team creates them in Twilio Console, a simple UPDATE adds the real SIDs.

Templates to seed:
- "Interview Invitation" — `Hi {{1}}, this is {{2}} from {{3}}. We'd like to invite you to interview for the {{4}} position. Would you be available to chat?`
- "Application Update" — `Hi {{1}}, thank you for your interest in the {{2}} role at {{3}}. We have an update regarding your application. Please reply to this message so we can share the details.`
- "Job Opportunity" — `Hi {{1}}, I'm {{2}} from {{3}}. I came across your profile and thought you'd be a great fit for a {{4}} opportunity we have. Would you be open to a quick conversation?`

### 9. Manual prerequisites (not code)
Before end-to-end works, the GoGio team needs to:
1. Register the provisioned number as a WhatsApp Sender in Twilio Console
2. Create Content templates in Twilio Console matching the seeded templates
3. Update `whatsapp_templates` rows with real `twilio_content_sid` values
4. Set the inbound webhook URL on the number in Twilio Console to `https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/whatsapp-inbound-webhook`

## Files to change

| File | Action |
|---|---|
| `supabase/functions/whatsapp-inbound-webhook/index.ts` | **Create** — public webhook for inbound messages |
| `src/components/settings/whatsapp/WhatsAppSetupWizard.tsx` | Simplify to 3 steps |
| `src/hooks/useWhatsAppConfig.ts` | Reduce setup states to 3 |
| `src/components/settings/WhatsAppIntegrationCard.tsx` | Remove template-count gating |
| `src/components/settings/whatsapp/WhatsAppTemplateLibrary.tsx` | Remove non-functional submit/refresh |
| `src/components/candidates/WhatsAppChatTab.tsx` | Simplify blocking logic |
| `supabase/functions/send-whatsapp/index.ts` | Minor cleanup |
| `supabase/config.toml` | Add `whatsapp-inbound-webhook` with `verify_jwt = false` |
| DB migration | Seed global templates |

