

# Fix: Deduplicate Email Notifications

## Problem
When a candidate replies to an email that includes the inbound catch address, two `email_logs` records are created for the same message — one from Gmail sync and one from the inbound reply webhook. Both share the same `rfc822_message_id`. The `fetchUnreadEmails` function in `usePendingActivities.ts` fetches all unread received emails without deduplicating, causing duplicate notifications in the Notification Center.

Confirmed by database query: there is at least one `rfc822_message_id` with 2 rows for the same candidate.

## Fix — `src/hooks/usePendingActivities.ts`

In `fetchUnreadEmails`, after fetching the emails, deduplicate by `rfc822_message_id` before returning. Keep only the first (most recent) record per message ID. For emails without an `rfc822_message_id` (null), treat each as unique.

Add the `rfc822_message_id` field to the select query, then filter duplicates:

```typescript
// Add rfc822_message_id to the select
.select(`
  id,
  candidate_id,
  job_id,
  subject,
  snippet,
  received_at,
  rfc822_message_id,
  candidates(id, candidate_name),
  jobs(id, title)
`)

// After fetching, deduplicate by rfc822_message_id
const seen = new Set<string>();
const dedupedEmails = (emails || []).filter(email => {
  const msgId = (email as any).rfc822_message_id;
  if (!msgId) return true; // no message ID, keep it
  if (seen.has(msgId)) return false;
  seen.add(msgId);
  return true;
});
```

Then map `dedupedEmails` instead of `emails`. Single file change, no schema or migration needed.

