

# WhatsApp Integration — Detailed Plan

## Architecture Overview

```text
Settings (Integrations)
  └── WhatsApp card → Connect Twilio → Configure sender number
        │
        ▼ (once connected)
Candidate Profile Sheet
  ├── Overview tab: WhatsApp icon next to each phone number
  │     └── Click → opens Chat tab + starts conversation
  └── Right panel tabs: [Chat] [Feed] [Notes] [Emails] ...
        └── Chat tab: conversation thread + compose field
              └── Each conversation scoped to candidate + job

Job Detail (Floating Sidebar)
  └── New "WhatsApp" icon below Pipeline
        └── Lists all WhatsApp conversations for that job

Notification Center
  └── WhatsApp message type alongside email/offer notifications
```

## Database

**Table: `whatsapp_messages`**
- `id`, `tenant_id`, `candidate_id`, `job_id`, `sender_id` (recruiter who sent), `to_phone`, `from_phone`, `body`, `twilio_sid`, `status` (sent/delivered/failed/received), `direction` (outbound/inbound), `created_at`
- RLS: tenant-scoped via `user_has_tenant_access(tenant_id)`

**Table: `whatsapp_conversations`**
- `id`, `tenant_id`, `candidate_id`, `job_id`, `phone_number` (candidate's), `last_message_at`, `last_message_preview`, `unread_count`, `created_at`
- Unique on `(tenant_id, candidate_id, job_id)`
- Purpose: fast lookups for job-level conversation lists and unread badges
- RLS: tenant-scoped

**Row in `workspace_automations`** (existing table)
- `automation_type = 'whatsapp_config'`
- `config` JSONB stores: `{ twilio_from_number: "whatsapp:+1...", is_connected: true }`

## Edge Function: `send-whatsapp`

- Receives: `{ to, body, candidate_id, job_id }`
- Sends via Twilio gateway (`https://connector-gateway.lovable.dev/twilio/Messages.json`)
- Prefixes numbers with `whatsapp:` for both `To` and `From`
- Upserts into `whatsapp_conversations` (updates `last_message_at`, `last_message_preview`)
- Inserts into `whatsapp_messages`
- Returns message SID

## UI Changes

### 1. Settings — Integrations Tab
- New `WhatsAppIntegrationCard` component added to `IntegrationsTab.tsx`
- Shows Twilio connection status, allows configuring the WhatsApp sender number
- Searchable/findable in the integrations list (not hidden, but not pre-activated)

### 2. Candidate Profile Sheet — Overview Tab (phone section)
- Next to each phone number's copy button, add a green WhatsApp icon button (only visible when WhatsApp is configured)
- Clicking it: switches right panel to the new "Chat" tab and auto-starts/opens the conversation for that candidate+job

### 3. Candidate Profile Sheet — Right Panel "Chat" Tab
- New tab inserted before "Feed" in the right panel tabs: `[Chat] [Feed] [Notes] [Emails] [Reminders] [Insights]`
- Only visible when WhatsApp integration is configured
- Shows conversation thread (messages sorted by `created_at`)
- Compose area at the bottom with text input + send button
- Messages displayed as chat bubbles (outbound right-aligned, inbound left-aligned)

### 4. Job Detail — Floating Sidebar
- New WhatsApp icon button added below "Pipeline Overview" (conditionally, only when WhatsApp is configured)
- New `whatsapp` tab in `JobDetailFloatingSidebar`
- Tab content: list of WhatsApp conversations for that job, showing candidate name, last message preview, timestamp, unread count
- Clicking a conversation opens the candidate profile sheet with Chat tab active

### 5. Notification Center
- Add `'whatsapp'` to `ActivityType`
- Query `whatsapp_messages` for inbound messages with `direction = 'inbound'` that are unread
- Show WhatsApp notifications with a WhatsApp icon, candidate name, message preview, and timestamp
- Clicking navigates to candidate profile with Chat tab open

## Files to Create
- `supabase/functions/send-whatsapp/index.ts`
- `src/hooks/useWhatsApp.ts` — send message, fetch conversations, fetch messages for a conversation
- `src/hooks/useWhatsAppConfig.ts` — check if WhatsApp is configured, get config
- `src/components/candidates/WhatsAppChatTab.tsx` — conversation thread + compose
- `src/components/settings/WhatsAppIntegrationCard.tsx`
- `src/components/jobs/WhatsAppConversationsList.tsx` — job-level conversation list

## Files to Modify
- `src/components/settings/IntegrationsTab.tsx` — add WhatsApp card
- `src/components/candidates/CandidateProfileSheet.tsx` — add WhatsApp button next to phones, add Chat tab to right panel
- `src/components/jobs/JobDetailFloatingSidebar.tsx` — add WhatsApp tab
- `src/hooks/usePendingActivities.ts` — add WhatsApp notification type
- `src/components/layout/NotificationCenter.tsx` — render WhatsApp notifications
- Migration for `whatsapp_messages` and `whatsapp_conversations` tables

## Implementation Order
1. Connect Twilio connector to project
2. Database migration (tables + RLS)
3. WhatsApp config in settings (integration card)
4. Edge function for sending messages
5. `useWhatsApp` and `useWhatsAppConfig` hooks
6. Chat tab in candidate profile sheet
7. WhatsApp button next to phone numbers in Overview
8. Job-level WhatsApp conversations list + floating sidebar tab
9. Notification center integration

