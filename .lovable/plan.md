## Problem

When a conversation is selected but has no messages yet, `src/components/chat/MessageList.tsx` renders a hand-rolled empty state using the **legacy** `<EmptyState variant="inline" mascot={false} icon={MessageSquare}>` path. This bypasses the canonical illustration-based empty state used elsewhere in Chat (e.g. `ThreadPane` no-thread state uses `<EmptyState size="card|route" illustration={<SoftBubble />} … />`), so it looks out of place — a small purple-circle icon instead of the Gio soft illustration, and inconsistent typography.

Per `mem://style/ui/empty-states-canonical-primitive` and the Empty States Build Spec, we should use the canonical primitive with an illustration. No other empty state in the chat module needs changes — `ConversationListPane` and `ThreadPane` already use canonical variants.

## Change

**File:** `src/components/chat/MessageList.tsx` (only)

Replace the current empty block (the `<div className="flex items-center justify-center py-14">…</div>` wrapping the legacy `<EmptyState>`) with the canonical card-sized empty state:

```tsx
<div className="flex items-center justify-center py-10">
  <EmptyState
    size="card"
    illustration={<SoftBubble />}
    title="No messages yet"
    body="Send the first message to start the conversation."
  />
</div>
```

- Import `SoftBubble` from `@/components/ui/EmptyIllustrations`.
- Drop the now-unused `MessageSquare` import.
- Keep everything else in `MessageList` unchanged (loading skeleton, pagination button, day separators, scroll behavior, `topSlot`).

No changes to data hooks, ThreadPane, ConversationListPane, or the empty-state primitive itself.

## Verification

- Type-check with `bunx tsgo --noEmit`.
- Visually confirm in preview: open a thread with zero messages → canonical SoftBubble illustration, Poppins title with purple period, Inter body copy, matching the pane-level empty states.
