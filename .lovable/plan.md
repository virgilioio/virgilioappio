

# WhatsApp Lightweight Integration

## Overview

Add an optional workspace-level WhatsApp toggle that, when enabled, shows WhatsApp shortcut buttons next to phone numbers in candidate profiles. Clicking opens `wa.me/<number>` in a new tab. No backend messaging infrastructure.

## Architecture

**Persistence**: Reuse existing `workspace_automations` table with `automation_type = 'whatsapp_integration'`. The `is_active` boolean controls visibility. No new DB tables or migrations needed.

**Hook**: Reuse `useWorkspaceAutomation('whatsapp_integration')` for read/write.

## Changes

### 1. WhatsApp integration card in Settings > Integrations

**New file: `src/components/settings/WhatsAppIntegrationDetail.tsx`**

Simple detail panel (matches existing pattern like `ChromeExtensionTokenCard`):
- Title: "WhatsApp"
- Description: "Enable WhatsApp shortcut actions across GoGio. Recruiters will be able to open candidate phone numbers directly in WhatsApp."
- A Switch toggle bound to `useWorkspaceAutomation('whatsapp_integration').toggle()`
- No misleading copy about sync, API, or inbox

**Modified: `src/components/settings/IntegrationsTab.tsx`**

Add a third entry to the `INTEGRATIONS` array:
- id: `whatsapp`
- name: "WhatsApp"
- description: "Open candidate phone numbers directly in WhatsApp with one click."
- category: `communication`
- logo: WhatsApp-green `MessageCircle` icon (or a custom SVG)
- `useIsConnected`: reads `useWorkspaceAutomation('whatsapp_integration')` `is_active`
- `DetailComponent`: `WhatsAppIntegrationDetail`

Update `useIntegrationStatuses` to include `whatsapp`.

### 2. WhatsApp icon component

**New file: `src/components/icons/WhatsAppIcon.tsx`**

Small inline SVG of the WhatsApp logo (green circle + phone), ~20 lines. Used in the integration card and candidate profile buttons.

### 3. Phone-to-WhatsApp utility

**Modified: `src/utils/phoneUtils.ts`**

Add:
```typescript
export function buildWhatsAppUrl(phone: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^\d]/g, '')
  return digits.length >= 7 ? `https://wa.me/${digits}` : null
}
```

### 4. Candidate profile WhatsApp button

**Modified: `src/components/candidates/CandidateProfileSheet.tsx`**

In the Phones Section (both `contact_phones` loop and fallback `candidate.phone` block), add a WhatsApp icon button **to the left** of the existing Copy button inside the `gap-0.5` flex container.

Conditionally rendered: only when `useWorkspaceAutomation('whatsapp_integration').automation?.is_active` is true AND phone is present.

Button: `variant="ghost"`, `size="sm"`, `className="h-6 w-6 p-0"`, opens `buildWhatsAppUrl(phoneValue)` in `_blank`.

**Modified: `src/components/candidates/IndependentCandidateProfileSheet.tsx`**

Same pattern — add WhatsApp button to the left of the Copy button in both the `contact_phones` loop and the fallback phone block.

### 5. Custom hook for convenience (optional but clean)

**New file: `src/hooks/useWhatsAppEnabled.ts`**

```typescript
export function useWhatsAppEnabled(): boolean {
  const { automation, isLoading } = useWorkspaceAutomation('whatsapp_integration')
  if (isLoading) return false
  return automation?.is_active ?? false
}
```

Used in both profile sheets to avoid repeating the workspace automation call.

## Files Summary

| File | Action |
|------|--------|
| `src/components/icons/WhatsAppIcon.tsx` | Create — small SVG icon |
| `src/components/settings/WhatsAppIntegrationDetail.tsx` | Create — toggle detail panel |
| `src/hooks/useWhatsAppEnabled.ts` | Create — convenience hook |
| `src/utils/phoneUtils.ts` | Add `buildWhatsAppUrl` |
| `src/components/settings/IntegrationsTab.tsx` | Add WhatsApp to INTEGRATIONS array |
| `src/components/candidates/CandidateProfileSheet.tsx` | Add conditional WhatsApp button next to phone copy buttons |
| `src/components/candidates/IndependentCandidateProfileSheet.tsx` | Same WhatsApp button |

No database migrations. No edge functions. No new tables.

