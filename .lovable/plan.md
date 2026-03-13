

# Delete WhatsApp Templates

## 1. Remove GoGio global templates

The GoGio templates (`tenant_id IS NULL`) were seeded via migrations but have no `twilio_content_sid` and can't be submitted by tenants. They add confusion — delete them from the database.

**Action**: Run a data operation to delete all rows from `whatsapp_templates` where `tenant_id IS NULL`.

## 2. Add a `delete` action to the edge function

Add a new `case "delete"` in `manage-whatsapp-templates/index.ts` that:

- Validates tenant ownership (`tmpl.tenant_id === tenantId`)
- If the template has a `twilio_content_sid`, calls `DELETE https://content.twilio.com/v1/Content/{contentSid}` to remove it from Twilio (this also withdraws the Meta approval request)
- Deletes the row from the `whatsapp_templates` table
- Returns success

**Key detail**: Twilio Content API supports `DELETE /v1/Content/{sid}` which removes the content resource regardless of approval status. So yes, already-submitted templates can be deleted.

## 3. Add `useDeleteWhatsAppTemplate` hook

New mutation in `useWhatsAppConfig.ts` that calls `{ action: 'delete', template_id }` and invalidates the query cache.

## 4. Add delete button to `WhatsAppTemplateLibrary.tsx`

Add a trash icon button on each **custom** template row (tenant-owned). Include a confirmation dialog before deleting. Available in all states (draft, pending, approved, rejected).

## Files to change

| File | Change |
|------|--------|
| DB (data delete) | Remove all `whatsapp_templates` rows where `tenant_id IS NULL` |
| `supabase/functions/manage-whatsapp-templates/index.ts` | Add `delete` action with Twilio cleanup |
| `src/hooks/useWhatsAppConfig.ts` | Add `useDeleteWhatsAppTemplate` hook |
| `src/components/settings/whatsapp/WhatsAppTemplateLibrary.tsx` | Add delete button with confirmation on custom templates |

