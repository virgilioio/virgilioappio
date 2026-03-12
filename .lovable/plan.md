

# Fully Managed WhatsApp Integration for GoGio

## The Vision

Users click "Enable WhatsApp" inside GoGio and everything works. No Twilio console, no Meta Business verification, no template submission. GoGio owns the infrastructure end-to-end.

## Architecture

```text
┌─────────────────────────────────────────────────────┐
│  GoGio Frontend (Settings > Integrations > WhatsApp)│
│                                                     │
│  [Enable WhatsApp]  ──────────────────────────┐     │
│  [Pick from Template Library]                 │     │
│  [Request Custom Template]                    │     │
└───────────────────────────────────────────────┼─────┘
                                                │
                    ┌───────────────────────────▼──────┐
                    │  Edge Functions                  │
                    │                                  │
                    │  provision-whatsapp-number        │
                    │    → Buy number via Twilio API   │
                    │    → Save to workspace_automations│
                    │                                  │
                    │  manage-whatsapp-templates       │
                    │    → Twilio Content API          │
                    │    → Create / list / check status│
                    │                                  │
                    │  send-whatsapp (updated)         │
                    │    → Uses ContentSid for first   │
                    │      contact, freeform in session│
                    └──────────────────────────────────┘
```

## What Changes

### 1. Database: `whatsapp_templates` table
Stores template metadata per tenant (or GoGio-global defaults).

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | PK |
| tenant_id | uuid (nullable) | null = GoGio global template |
| name | text | Internal label ("Interview Invite") |
| category | text | MARKETING / UTILITY / AUTHENTICATION |
| language | text | e.g. "en" |
| body_template | text | Template text with `{{1}}` vars |
| variable_mapping | jsonb | Maps vars to candidate/job fields |
| twilio_content_sid | text | Returned by Twilio Content API |
| approval_status | text | draft / pending / approved / rejected |
| created_at / updated_at | timestamps | |

RLS: tenant members can read their own + global (tenant_id is null). Only admins write.

### 2. Database: Add `whatsapp_number` + `whatsapp_number_sid` to workspace_automations config
When GoGio provisions a number, store both the E.164 number and the Twilio number SID for management.

### 3. Edge Function: `provision-whatsapp-number`
- Buys an available Twilio number via `/IncomingPhoneNumbers.json`
- Enables WhatsApp on it (via Twilio WhatsApp Senders API)
- Saves number to `workspace_automations` config for the tenant
- Returns the provisioned number

Important caveat: WhatsApp sender registration on a Twilio number requires Meta Business verification. GoGio would handle this under GoGio's own Meta Business account. All tenants share GoGio's verified business but get their own dedicated numbers.

### 4. Edge Function: `manage-whatsapp-templates`
Actions: `list`, `create`, `check-status`
- **list**: Returns GoGio global templates + tenant custom templates
- **create**: Submits a new template via Twilio Content API (`POST /v1/Content`), saves to DB with status `pending`
- **check-status**: Polls Twilio for approval status updates

### 5. Update `send-whatsapp` edge function
- For first-contact (no 24h session): require a `template_id`, resolve it to `ContentSid`, send via `ContentSid` + `ContentVariables`
- For session messages (within 24h window): allow freeform `Body` as today

### 6. Frontend: New WhatsApp Settings UI
Replace the current manual number input card with:

**Step 1 - Number Provisioning**
- Single "Enable WhatsApp" button
- Shows spinner while provisioning
- Once done: displays assigned number with green "Active" badge

**Step 2 - Template Library**
- Tab/section showing available templates
- GoGio pre-built templates (read-only, always available): "Interview Invitation", "Application Update", "Follow-up Reminder", etc.
- "Request Custom Template" form: name, category, body with variable placeholders
- Status badges: Approved / Pending / Rejected

### 7. Frontend: Update Chat Tab
- When sending first message to a candidate (no existing 24h session), show template picker instead of freeform input
- After candidate replies (session open), switch to freeform input
- Visual indicator showing session status

## GoGio Pre-Built Template Library (Initial Set)
These ship as seed data, submitted under GoGio's Twilio account:

1. **Interview Invitation** - "Hi {{1}}, this is {{2}} from {{3}}. We'd like to invite you for an interview for the {{4}} position. Please reply to confirm your availability."
2. **Application Received** - "Hi {{1}}, thank you for applying to {{2}} at {{3}}. We've received your application and will be in touch soon."
3. **Follow-up** - "Hi {{1}}, this is {{2}} from {{3}}. We wanted to follow up regarding the {{4}} position. Are you still interested?"
4. **Schedule Reminder** - "Hi {{1}}, this is a reminder about your upcoming interview for {{2}} at {{3}} on {{4}}."
5. **General Outreach** - "Hi {{1}}, this is {{2}} from {{3}}. We have an opportunity that might interest you. Would you like to learn more?"

## Implementation Order

1. Create `whatsapp_templates` table + RLS
2. Build `provision-whatsapp-number` edge function
3. Build `manage-whatsapp-templates` edge function
4. Update `send-whatsapp` to support ContentSid
5. Seed GoGio global templates
6. Replace WhatsApp settings UI (number provisioning + template library)
7. Update chat tab with template picker for first contact

## Key Dependency

GoGio needs a Twilio account with:
- Ability to purchase phone numbers programmatically
- WhatsApp Business Profile registered with Meta under GoGio's business
- Content API access for template management

The Twilio connector is already connected. Number provisioning and Content API both work through the same gateway.

