

# Auto-Refresh Template Approval Status

## Problem
The "Refresh" button works, but the user has to manually click it. The `list` action just returns DB data without polling Twilio, so templates stay "Pending" even after Meta approves them.

## Solution
Two complementary fixes:

### 1. Auto-poll on list (server-side)
In the `list` action of `manage-whatsapp-templates/index.ts`, after fetching templates from DB, loop through any templates that have a `twilio_content_sid` and `approval_status = 'pending'`, poll Twilio for each, and update the DB if the status changed. Return the updated data.

This means every time the template library loads, pending templates get their status refreshed automatically.

### 2. Client-side auto-refetch (polling)
In `useWhatsAppTemplates()` hook, add `refetchInterval: 30000` (30 seconds) so the template list auto-refreshes while the user is on the settings page. This way if they're watching the page, pending templates will update within 30 seconds of approval.

## Files to change

| File | Change |
|------|--------|
| `supabase/functions/manage-whatsapp-templates/index.ts` | In the `list` action, auto-poll Twilio for any pending templates and update DB before returning |
| `src/hooks/useWhatsAppConfig.ts` | Add `refetchInterval: 30000` to `useWhatsAppTemplates` query, but only when there are pending templates |

## Detail: List action change

```typescript
case "list": {
  const { data: templates, error } = await supabase
    .from("whatsapp_templates")
    .select("*")
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .order("created_at", { ascending: true });

  if (error) throw error;

  // Auto-refresh pending templates
  const pendingTemplates = (templates || []).filter(
    t => t.twilio_content_sid && t.approval_status === "pending"
  );

  for (const tmpl of pendingTemplates) {
    try {
      const statusRes = await fetch(
        `https://content.twilio.com/v1/Content/${tmpl.twilio_content_sid}/ApprovalRequests`,
        { headers: { Authorization: twilioBasicAuth() } }
      );
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const wa = statusData.approval_requests?.find(r => r.channel === "whatsapp");
        if (wa) {
          let mapped = "pending";
          const s = (wa.status || "").toLowerCase();
          if (s === "approved") mapped = "approved";
          else if (s === "rejected" || s === "failed") mapped = "rejected";

          if (mapped !== tmpl.approval_status) {
            await supabase.from("whatsapp_templates")
              .update({ approval_status: mapped })
              .eq("id", tmpl.id);
            tmpl.approval_status = mapped; // update in-memory for response
          }
        }
      }
    } catch (e) {
      console.error(`[WhatsApp] Failed to poll status for ${tmpl.id}:`, e);
    }
  }

  return new Response(JSON.stringify({ templates: templates || [] }), { ... });
}
```

