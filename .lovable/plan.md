

# Subtle Conversation-Style Email History

Very light touch -- just enough to visually distinguish sent vs received at a glance, while keeping it clearly an email thread (not a chat app).

## Changes

### File: `src/components/candidates/EmailHistoryCard.tsx`

Three subtle tweaks:

1. **Slight offset**: Wrap the Card in a container div. Sent emails get a small left margin (`ml-6`), received emails get a small right margin (`mr-6`). This creates a gentle ~24px nudge without going full chat-bubble.

2. **Subtle background tint on the Card itself**:
   - **Sent**: Very faint lilac -- `bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30`
   - **Received**: Very faint blue -- `bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30`
   - **Fallback** (no direction): Keep current neutral styling

3. **Remove the "Received" badge** (line 105-109) since the color/alignment already communicates direction. Replace with a tiny colored dot or just rely on the tint.

### File: `src/components/candidates/EmailHistoryList.tsx`

No changes needed -- the thread grouping and spacing already works well.

## Technical Detail

The only real code change is on line 98-99 of `EmailHistoryCard.tsx`:

```tsx
// Before
<Card className="relative transition-all overflow-hidden min-w-0">

// After
<div className={cn(isSent ? "ml-6" : isReceived ? "mr-6" : "")}>
  <Card className={cn(
    "relative transition-all overflow-hidden min-w-0",
    isSent && "bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30",
    isReceived && "bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30"
  )}>
    {/* ...existing content unchanged... */}
  </Card>
</div>
```

That's it -- two lines of wrapper + conditional classes. Everything else stays exactly the same.
