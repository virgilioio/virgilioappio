

# Add Quick Reply and Call-to-Action Content Types to WhatsApp Templates

## Overview

Extend the template system to support three Twilio Content API types: `twilio/text` (existing), `twilio/quick-reply` (up to 3 buttons), and `twilio/call-to-action` (up to 2 URL/phone buttons). Changes span the template creator UI, the DB schema, the edge function that creates/submits templates, and the send function.

## Database Changes

Add a `content_type` column and an `actions` JSONB column to `whatsapp_templates`:

- `content_type TEXT NOT NULL DEFAULT 'text'` -- values: `text`, `quick_reply`, `call_to_action`
- `actions JSONB` -- stores button definitions:
  - Quick Reply: `[{ "title": "Yes" }, { "title": "No" }, { "title": "Maybe" }]`
  - Call-to-Action: `[{ "type": "URL", "title": "Apply Now", "url": "https://..." }, { "type": "PHONE_NUMBER", "title": "Call Us", "phone": "+1..." }]`

## UI Changes — WhatsAppTemplateCreator

1. Add a **Content Type** selector (radio group or select) below Category/Language: Text, Quick Reply, Call-to-Action.

2. **Quick Reply mode**: Show up to 3 button inputs below the message body. Each is a short text field (max 20 chars). Add/remove buttons dynamically (min 1, max 3).

3. **Call-to-Action mode**: Show up to 2 action rows. Each row has a type selector (URL or Phone), a title input (max 20 chars), and a URL or phone input. Add/remove rows (min 1, max 2).

4. **Preview**: Render buttons below the message preview — quick reply as rounded pill buttons, CTA as tappable link-style buttons.

5. **Validation**: Ensure button titles are non-empty, URLs are valid, phone numbers are E.164.

## Edge Function Changes — manage-whatsapp-templates

### Create action
- Accept `content_type` and `actions` params, store them in DB.

### Submit action
- Build the Twilio Content API payload based on `content_type`:

```text
text → { "twilio/text": { body } }

quick_reply → { "twilio/quick-reply": { body, actions: [{ id: "btn_1", title: "Yes" }, ...] } }

call_to_action → { "twilio/call-to-action": { body, actions: [{ type: "URL", title: "Apply", url: "..." }, { type: "PHONE_NUMBER", title: "Call", phone: "..." }] } }
```

### Update action
- Allow updating `content_type` and `actions` for draft templates.

## Edge Function Changes — send-whatsapp

- When sending a template with a `twilio_content_sid`, the existing `ContentSid` + `ContentVariables` flow already works for all content types — Twilio handles rendering. No changes needed here.

## Files Modified

| File | Change |
|------|--------|
| DB migration | Add `content_type` and `actions` columns |
| `src/hooks/useWhatsAppConfig.ts` | Add `content_type` and `actions` to `WhatsAppTemplate` type and mutation params |
| `src/components/settings/whatsapp/WhatsAppTemplateCreator.tsx` | Add content type selector, button editors for quick reply and CTA, preview rendering, validation |
| `supabase/functions/manage-whatsapp-templates/index.ts` | Handle `content_type` and `actions` in create/update/submit actions; build correct Twilio Content payload per type |

