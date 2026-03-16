

# WhatsApp Pre-filled Template — First Click Per Job Association Only

## Concept

When a recruiter clicks the WhatsApp icon on a candidate profile:
- **First click** (for that candidate+job association): opens `wa.me` with the pre-filled template message (`?text=...`)
- **Subsequent clicks** (same association): opens `wa.me` without any pre-filled text

This is tracked via a new `whatsapp_template_sent_at` timestamp column on `job_candidate_associations`, similar to the existing `booking_link_sent_at` pattern.

**Independent candidates** (no job association): the WhatsApp button always opens without the template, since there's no association to track against.

## Changes

### 1. Database migration

Add column to `job_candidate_associations`:

```sql
ALTER TABLE job_candidate_associations
ADD COLUMN whatsapp_template_sent_at timestamptz DEFAULT NULL;
```

No RLS changes needed — existing policies already cover this table.

### 2. WhatsApp integration settings — add template textarea

**Modified: `src/components/settings/WhatsAppIntegrationDetail.tsx`**

Below the existing toggle, add:
- A `Textarea` for the message template (saved to `automation.body`)
- Placeholder hint: `Hi {{candidate.first_name}}, this is {{sender.first_name}} from {{organization.name}}...`
- Small helper text listing available placeholders
- Save button calling `save({ body: templateText })`
- Only shown when the toggle is enabled

### 3. Extend `useWhatsAppEnabled` hook

**Modified: `src/hooks/useWhatsAppEnabled.ts`**

Return `messageTemplate: automation?.body ?? null` alongside existing fields.

### 4. Update `buildWhatsAppUrl`

**Modified: `src/utils/phoneUtils.ts`**

Add optional `text` parameter:

```typescript
export function buildWhatsAppUrl(phone: string, text?: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^\d]/g, '')
  if (digits.length < 7) return null
  const url = `https://wa.me/${digits}`
  return text ? `${url}?text=${encodeURIComponent(text)}` : url
}
```

### 5. CandidateProfileSheet — first-click template logic

**Modified: `src/components/candidates/CandidateProfileSheet.tsx`**

This sheet has `jobId` and the association record. On WhatsApp button click:

1. Check if the association's `whatsapp_template_sent_at` is null
2. If null AND a template exists: resolve placeholders using `renderTemplate()` with candidate/sender/org data, open the URL with `?text=`, then update the association to set `whatsapp_template_sent_at = now()`
3. If already set: open plain `wa.me` URL without text

### 6. IndependentCandidateProfileSheet — no template

**No change to behavior** — this sheet has no job association, so the WhatsApp button always opens without a template. Keep as-is.

## Files Summary

| File | Change |
|------|--------|
| Database migration | Add `whatsapp_template_sent_at` column |
| `src/components/settings/WhatsAppIntegrationDetail.tsx` | Add template textarea + save |
| `src/hooks/useWhatsAppEnabled.ts` | Return `messageTemplate` |
| `src/utils/phoneUtils.ts` | Add optional `text` param |
| `src/components/candidates/CandidateProfileSheet.tsx` | First-click template logic with association tracking |

