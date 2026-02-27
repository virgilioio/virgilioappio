

# Fix Email History to Show Chronological Order

## Problem

Emails in the history are not displayed in chronological order. The current query sorts by `received_at DESC` first, then `sent_at DESC` as a secondary sort. This means all received emails (which have `received_at` populated) cluster together, and all sent emails (which have `sent_at` populated but `received_at = null`) cluster separately -- rather than interleaving in true conversation order.

## Solution

### 1. Fix the query ordering (`src/hooks/useEmailLogs.ts`)

Replace the two `.order()` calls with a single sort by `created_at DESC`. The `created_at` column is populated for every row regardless of direction, making it the reliable unified timestamp.

**Before:**
```
.order('received_at', { ascending: false, nullsFirst: false })
.order('sent_at', { ascending: false, nullsFirst: false })
```

**After:**
```
.order('created_at', { ascending: false })
```

### 2. Simplify the rendering (`src/components/candidates/EmailHistoryList.tsx`)

Remove the thread-grouping logic entirely. Instead, render all emails as a flat chronological list (newest first). The thread grouping was causing visual clustering that broke the natural conversation flow.

- Remove the `threads` reduce and `sortedThreads` sort logic (lines 79-100)
- Render `emails` directly in a flat list
- Update the summary line to just show email count (remove "conversations" count)

### Files changed

| File | Change |
|------|--------|
| `src/hooks/useEmailLogs.ts` | Replace dual `.order()` with single `.order('created_at', { ascending: false })` |
| `src/components/candidates/EmailHistoryList.tsx` | Remove thread grouping; render flat chronological list |

