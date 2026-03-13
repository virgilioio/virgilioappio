

# Automate WhatsApp Template Submission via Twilio Content API

## Context

The `submit` action in `manage-whatsapp-templates` is currently a stub. We already have `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_MESSAGING_SERVICE_SID` as secrets. The Twilio Content API lives at `content.twilio.com` (not reachable via the connector gateway), so we call it directly with Basic Auth — same pattern as the sender registration in provisioning.

## Twilio Content API Flow

1. **Create** a Content resource: `POST https://content.twilio.com/v1/Content` with the template body and variables
2. **Submit** for WhatsApp approval: `POST https://content.twilio.com/v1/Content/{ContentSid}/ApprovalRequests/whatsapp`
3. **Poll** approval status: `GET https://content.twilio.com/v1/Content/{ContentSid}/ApprovalRequests`

## Implementation

### 1. Update `manage-whatsapp-templates/index.ts` — `submit` action

Replace the TODO stub with real Twilio Content API calls:

```typescript
// Step 1: Create Content resource
const contentPayload = {
  friendly_name: tmpl.name,
  language: tmpl.language,
  types: {
    "twilio/text": {
      body: tmpl.body_template  // already in {{1}}, {{2}} format
    }
  },
  // Add variables if mapping exists
  variables: Object.fromEntries(
    Object.keys(tmpl.variable_mapping || {}).map(k => [k, `{{${k}}}`])
  )
};

const contentRes = await fetch("https://content.twilio.com/v1/Content", {
  method: "POST",
  headers: {
    Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
    "Content-Type": "application/json",
  },
  body: JSON.stringify(contentPayload),
});

// Step 2: Submit for WhatsApp approval
await fetch(`https://content.twilio.com/v1/Content/${contentSid}/ApprovalRequests/whatsapp`, {
  method: "POST",
  headers: {
    Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: tmpl.name,
    category: tmpl.category.toLowerCase(),
  }),
});

// Step 3: Update DB with Content SID and status
UPDATE whatsapp_templates SET twilio_content_sid = contentSid, approval_status = 'pending'
```

### 2. Update `manage-whatsapp-templates/index.ts` — `check-status` action

When a template has a `twilio_content_sid`, poll Twilio for the real approval status:

```typescript
const statusRes = await fetch(
  `https://content.twilio.com/v1/Content/${template.twilio_content_sid}/ApprovalRequests`,
  { headers: { Authorization: "Basic " + btoa(...) } }
);
// Map Twilio status → our status (approved/rejected/pending)
// Update DB if changed
```

### 3. Update `WhatsAppTemplateLibrary.tsx` — Add Submit + Refresh buttons back

For custom templates (tenant-owned) that are in "Draft" state (no `twilio_content_sid`):
- Show a "Submit for Approval" button that calls `useSubmitWhatsAppTemplate`
- Show a "Refresh Status" button for templates in "pending" state

### 4. Update `WhatsAppTemplateCreator.tsx` — Improve flow text

Change the note from "Contact GoGio team" to "Submit it for Meta approval from the Template Library" since submission is now automated.

### 5. Update `WhatsAppTemplateLibrary.tsx` — Update info banner

Change from "Custom templates require GoGio team approval" to "Custom templates are submitted directly to Meta for approval. This typically takes minutes but can take up to 48 hours."

## Files to change

| File | Change |
|------|--------|
| `supabase/functions/manage-whatsapp-templates/index.ts` | Implement real Content API calls in `submit` + `check-status` actions |
| `src/components/settings/whatsapp/WhatsAppTemplateLibrary.tsx` | Add Submit/Refresh buttons per template, update info banner |
| `src/components/settings/whatsapp/WhatsAppTemplateCreator.tsx` | Update guidance text |

No new secrets needed — `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are already configured.

