

# WhatsApp Integration — Implementation Plan

## Approach: Platform-Owned Twilio Account

GoGio owns the Twilio account. Each workspace configures their WhatsApp sender number (obtained from Twilio) in settings. All recruiters in the workspace share that number; messages are attributed internally via `sender_id`.

---

## Phase 1: Infrastructure (Database + Edge Function + Twilio Connection)

### Connect Twilio
- Use `standard_connectors--connect` for Twilio connector
- This provides `TWILIO_API_KEY` and `LOVABLE_API_KEY` as env vars for edge functions

### Database Migration
Two new tables:

**`whatsapp_conversations`** — one per candidate+job pair
- `id` uuid PK, `tenant_id`, `candidate_id`, `job_id`, `phone_number` (candidate's), `last_message_at`, `last_message_preview`, `unread_count` default 0, `created_at`
- Unique constraint on `(tenant_id, candidate_id, job_id)`
- RLS: tenant-scoped via `user_has_tenant_access(tenant_id)`

**`whatsapp_messages`** — individual messages
- `id` uuid PK, `conversation_id` FK, `tenant_id`, `candidate_id`, `job_id`, `sender_id` (recruiter), `to_phone`, `from_phone`, `body`, `twilio_sid`, `status` (sent/delivered/failed/received), `direction` (outbound/inbound), `created_at`
- RLS: tenant-scoped

### Edge Function: `send-whatsapp`
- Receives `{ to, body, candidate_id, job_id }`
- Looks up tenant's WhatsApp config from `workspace_automations` (type `whatsapp_config`) to get `from` number
- Sends via Twilio gateway: `https://connector-gateway.lovable.dev/twilio/Messages.json` with `whatsapp:` prefix on both To and From
- Upserts `whatsapp_conversations`, inserts into `whatsapp_messages`
- Config in `config.toml`: `verify_jwt = false` (validates auth in code)

### WhatsApp Config Storage
Uses existing `workspace_automations` table with `automation_type = 'whatsapp_config'`:
```json
{ "twilio_from_number": "whatsapp:+1...", "is_connected": true }
```

---

## Phase 2: Settings UI

### `WhatsAppIntegrationCard` component
- Added to `IntegrationsTab.tsx` after Google Workspace section
- Card showing WhatsApp logo, connection status badge
- Input field for the WhatsApp-enabled Twilio number (with validation for E.164 format)
- Save button stores config in `workspace_automations`
- Helper text explaining: "Enter your Twilio WhatsApp-enabled number. Get one from your Twilio console."

### `useWhatsAppConfig` hook
- Wraps `useWorkspaceAutomation('whatsapp_config')`
- Exposes `isConfigured`, `fromNumber`, `save`, `toggle`

---

## Phase 3: Candidate Profile — Chat Tab + WhatsApp Button

### WhatsApp button next to phone numbers (Overview tab)
- In `CandidateProfileSheet.tsx`, next to each phone's Copy button, add a green WhatsApp icon button
- Only visible when `useWhatsAppConfig().isConfigured` is true
- Clicking sets `rightActiveTab` to `'chat'` and stores the selected phone number

### New "Chat" tab in right panel
- Add `'chat'` to `rightActiveTab` type: `'chat' | 'feed' | 'notes' | 'emails' | 'reminders' | 'insights'`
- Insert before "Feed" in the tabs array (only when WhatsApp is configured)
- New `WhatsAppChatTab` component:
  - Fetches messages for the candidate+job conversation via `useWhatsApp` hook
  - Chat bubble UI (outbound right-aligned, inbound left-aligned)
  - Compose area at bottom with text input + send button
  - Auto-scrolls to latest message

### `useWhatsApp` hook
- `useConversation(candidateId, jobId)` — fetches/creates conversation
- `useMessages(conversationId)` — fetches messages sorted by created_at
- `sendMessage(to, body, candidateId, jobId)` — calls `send-whatsapp` edge function
- `useJobConversations(jobId)` — fetches all conversations for a job

---

## Phase 4: Job Detail — WhatsApp Sidebar Tab

### `JobDetailFloatingSidebar` modification
- Add WhatsApp icon button below Pipeline (conditionally, when WhatsApp is configured)
- New tab id: `'whatsapp'`

### `WhatsAppConversationsList` component
- Lists all WhatsApp conversations for the job
- Shows: candidate name, last message preview, timestamp, unread count badge
- Clicking opens candidate profile sheet with Chat tab active

### `JobDetail.tsx` modification
- Add `TabsContent value="whatsapp"` rendering `WhatsAppConversationsList`

---

## Phase 5: Notification Center

### `usePendingActivities` modification
- Add `'whatsapp'` to `ActivityType`
- Query `whatsapp_messages` where `direction = 'inbound'` and conversation has `unread_count > 0`
- Map to `PendingActivity` with WhatsApp-specific fields

### `NotificationCenter` modification
- Render WhatsApp notifications with green WhatsApp icon
- Show candidate name, message preview, timestamp
- Click navigates to candidate profile with `chat` tab active

---

## Files Summary

**Create:**
- `supabase/functions/send-whatsapp/index.ts`
- `src/hooks/useWhatsApp.ts`
- `src/hooks/useWhatsAppConfig.ts`
- `src/components/candidates/WhatsAppChatTab.tsx`
- `src/components/settings/WhatsAppIntegrationCard.tsx`
- `src/components/jobs/WhatsAppConversationsList.tsx`

**Modify:**
- `supabase/config.toml` — add `[functions.send-whatsapp]`
- `src/components/settings/IntegrationsTab.tsx` — add WhatsApp card
- `src/components/candidates/CandidateProfileSheet.tsx` — add Chat tab + WhatsApp button next to phones
- `src/components/jobs/JobDetailFloatingSidebar.tsx` — add WhatsApp tab
- `src/pages/JobDetail.tsx` — add WhatsApp TabsContent
- `src/hooks/usePendingActivities.ts` — add WhatsApp notification type
- `src/components/layout/NotificationCenter.tsx` — render WhatsApp notifications
- `src/types/activity.ts` — add `'whatsapp'` to ActivityType

