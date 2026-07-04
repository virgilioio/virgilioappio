## Problem

The Emails tab mounts `useEmailLogs(candidateId, jobId)` twice on the same page:
- Once inside `EmailsTabContent` (for the header count/subtitle)
- Once inside `EmailHistoryList` (for the actual list)
- And a third time in `EmailsSidebarContainer` for the sidebar

`useEmailLogs` creates a Supabase Realtime channel with a **hardcoded name** `'email-logs-changes'`. When multiple instances mount simultaneously, they collide on that shared channel name and Supabase throws:

> tried to subscribe multiple times. 'subscribe' can only be called a single time per channel instance

## Fix

Make the channel name unique per subscription instance in `src/hooks/useEmailLogs.ts`:

- Include `candidateId`, `jobId`, and a per-instance random suffix (e.g. `crypto.randomUUID()` captured in a `useRef`) in the channel name: `email-logs-changes:${candidateId}:${jobId ?? 'all'}:${instanceId}`.
- Keep the existing `useEffect` cleanup that calls `supabase.removeChannel(channel)`.

This matches the pattern already used elsewhere in the app (e.g. `useChatRealtime` uses IDs in channel names) and lets the hook be reused safely across `EmailsTabContent`, `EmailHistoryList`, and `EmailsSidebarContainer` on the same page without changing any calling component.

## Files to change

- `src/hooks/useEmailLogs.ts` — unique channel name per hook instance.

No other files need edits; the three call sites remain untouched.
