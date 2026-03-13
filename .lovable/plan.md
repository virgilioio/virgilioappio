

# Block Consecutive Outbound Messages Until Candidate Replies

## Policy
Per WhatsApp Business API rules, outside the 24-hour window (opened by an inbound message), only **one** pre-approved template message may be sent. Sending additional templates without a reply risks spam flags and account suspension.

## Change — `src/components/candidates/WhatsAppChatTab.tsx`

**Add `awaitingReply` flag** (~line 70, after `needsTemplate`):
```typescript
const hasOutboundMessages = messages.some((m) => m.direction === 'outbound')
const awaitingReply = hasOutboundMessages && !hasActiveSession
```

**Replace compose area** (~line 283 onward):
When `awaitingReply` is true, replace the entire compose section with an info banner:
- Clock icon + amber/yellow styling
- Text: "Waiting for reply — You've already sent a template message. Per WhatsApp policy, you cannot send another message until the candidate responds (within 24 hours)."
- No send button, no template selector, no text input

When `awaitingReply` is false, show the existing compose UI unchanged.

## File

| File | Change |
|---|---|
| `src/components/candidates/WhatsAppChatTab.tsx` | Add `awaitingReply` flag, conditionally render locked compose area with policy explanation |

