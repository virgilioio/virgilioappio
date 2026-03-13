

# Fix: WhatsApp Error Visibility + Error 63112 Handling

## Problem
1. **No user feedback on send failure** — the `handleSend` catch block is empty (`// Error handled by mutation`) but the mutation has no `onError` handler either. Failures are silently swallowed.
2. **Error 63112 not mapped** — the edge function's `errorMap` doesn't include the Meta account disabled error code.
3. **Message status not visually distinct** — failed messages show the same as sent ones; no red indicator for errors.

## Changes

### 1. `supabase/functions/send-whatsapp/index.ts`
Add error code 63112 to the `errorMap` (~line 169):
```
63112: "Your WhatsApp Business Account has been disabled by Meta. Please check your Meta Business verification status and contact support if needed."
```

### 2. `src/components/candidates/WhatsAppChatTab.tsx`
**Add toast feedback on send** (~lines 130-158):
- On success: `toast.success('Message sent')` 
- On error: `toast.error(error.message || 'Failed to send message')` — surfaces the friendly error from the edge function

**Color-code message status** (~lines 259-267):
- If `msg.status` is `failed` or `undelivered`, show status text in red (`text-destructive`)
- If `sent`/`delivered`/`read`, keep current muted style

### 3. `src/hooks/useWhatsApp.ts` — `useSendWhatsAppMessage`
No changes needed — errors propagate via `mutateAsync` which throws on failure. The fix is in the component's catch block.

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/send-whatsapp/index.ts` | Add error 63112 to errorMap |
| `src/components/candidates/WhatsAppChatTab.tsx` | Add toast on success/error, color-code failed message status |

