

# Sanitize Template Name for Twilio/Meta Submission

## Problem
Meta requires WhatsApp template names to contain only lowercase alphanumeric characters and underscores. We're sending the human-readable name (e.g., "Prospección Inicial") directly.

## Solution
Add a name sanitization function in `manage-whatsapp-templates/index.ts` that converts the display name into a Meta-compatible slug. Apply it to both the `friendly_name` (Content API) and the `name` (Approval API).

### Sanitization logic
```typescript
function sanitizeTemplateName(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, "")  // remove non-alphanumeric except spaces/underscores
    .trim()
    .replace(/\s+/g, "_");          // spaces → underscores
}
// "Prospección Inicial" → "prospeccion_inicial"
```

### File: `supabase/functions/manage-whatsapp-templates/index.ts`
- Add `sanitizeTemplateName` helper at the top
- Line 190: change `friendly_name: tmpl.name` → `friendly_name: sanitizeTemplateName(tmpl.name)`
- Line 237: change `name: tmpl.name` → `name: sanitizeTemplateName(tmpl.name)`

The display name in the DB stays unchanged — only the name sent to Twilio/Meta is sanitized.

