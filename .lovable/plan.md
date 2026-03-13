

# Enable Draft Template Editing + Submit Confirmation Dialog

## Overview
Add an ellipsis (three-dot) menu to draft templates with "Edit" and "Delete" options. Replace the standalone delete button. When submitting, show a confirmation dialog warning that approved templates cannot be edited.

## Changes

### 1. `WhatsAppTemplateCreator.tsx` — Support edit mode
- Accept an optional `editTemplate` prop with existing template data
- When provided, pre-populate the form and change title to "Edit message template", button to "Save changes"
- On save in edit mode, call a new `useUpdateWhatsAppTemplate` hook instead of create

### 2. `useWhatsAppConfig.ts` — Add update hook
- Add `useUpdateWhatsAppTemplate` mutation calling `{ action: 'update', template_id, name, body_template, category, language }`
- Invalidates `whatsapp-templates` query on success

### 3. `manage-whatsapp-templates/index.ts` — Add `update` action
- New `case "update"` that validates tenant ownership and ensures template is still a draft (no `twilio_content_sid`)
- Updates `name`, `body_template`, `category`, `language`, and re-derives `variable_mapping` using the same named-placeholder conversion logic

### 4. `WhatsAppTemplateLibrary.tsx` — Ellipsis menu + submit confirmation
- For draft templates: replace the Submit button + Delete button with a `DropdownMenu` triggered by a `MoreHorizontal` icon
  - Menu items: "Edit template", "Submit for approval", "Delete" (in destructive style)
- Add a submit confirmation `AlertDialog`:
  - **Title:** "Submit for approval?"
  - **Body:** "Once submitted and approved by Meta, this template can no longer be edited. You would need to delete it and create a new one. This process may take up to 48 hours."
  - **Actions:** "Cancel" / "Submit template"
- For non-draft templates: keep Refresh and Delete as-is
- Add state for `editingTemplate` to open the creator in edit mode

### 5. `WhatsAppTemplateCreator.tsx` — Wire edit flow
- When `editTemplate` is passed, the sheet opens pre-filled
- The body needs to be "un-converted" back to named placeholders for editing (reverse the `variable_mapping`: replace `{{1}}` with `{{candidate.first_name}}` etc.)
- On close, clear `editTemplate`

## Files to change

| File | Change |
|------|--------|
| `supabase/functions/manage-whatsapp-templates/index.ts` | Add `update` action (draft-only, re-derives variable mapping) |
| `src/hooks/useWhatsAppConfig.ts` | Add `useUpdateWhatsAppTemplate` hook |
| `src/components/settings/whatsapp/WhatsAppTemplateCreator.tsx` | Accept `editTemplate` prop, pre-populate form, call update vs create |
| `src/components/settings/whatsapp/WhatsAppTemplateLibrary.tsx` | Add ellipsis `DropdownMenu` for drafts, submit confirmation dialog, edit state |

