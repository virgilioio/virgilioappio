## Problem

On the Dashboard **"Your queue"** card, checking off a **Reply needed** row briefly hides it, then the same reply comes back on the next refetch.

## Root cause

Inbound emails commonly land in `email_logs` **twice** — once from Gmail sync and once from the inbound webhook — as two rows with different `id`s but the **same `rfc822_message_id`**.

- `fetchUnreadEmails` (`src/hooks/usePendingActivities.ts`) queries `is_read = false`, then dedupes the results by `rfc822_message_id` in JS.
- When the user checks off a Reply row, `Dashboard.tsx` (`toggleDone`) runs `update({ is_read: true }).eq('id', item.emailId)` — updating **only one** of the duplicate rows.
- On the invalidated refetch, the *other* duplicate (still `is_read = false`) is returned. It has a different `email.id`, so the queue builds a new row id `e-<otherId>` that isn't in the persisted `doneIds` set — the reply reappears.

The dismissed-ids set and the 7-day localStorage persistence work correctly; the mismatch is on the DB side.

## Fix

Mark **every** `email_logs` row that shares the same `rfc822_message_id` as read, so the deduped fetch can never resurface a sibling row.

### Change 1 — `src/hooks/usePendingActivities.ts`

Update `markEmailAsRead.mutationFn`:

1. Read the row's `rfc822_message_id` (single `select`).
2. If present, `update({ is_read: true })` filtered by `rfc822_message_id` (updates all duplicates).
3. If null/absent, fall back to the existing `.eq('id', emailId)` update.

Keep the same `onSuccess` invalidation.

### Change 2 — `src/pages/Dashboard.tsx` (`toggleDone`)

Replace the inline `supabase.from('email_logs').update(...).eq('id', item.emailId)` block with a call to the shared `markEmailAsRead` mutation exposed by `usePendingActivities`, so the reply/duplicate-safe logic lives in one place. Preserve current behavior: only fire when transitioning to done (not when un-checking), and keep the existing `queryClient.invalidateQueries({ queryKey: ['pending-activities'] })` (already handled by the mutation's `onSuccess`).

No schema changes, no UI changes, no other queue types touched.

## Verification

- Type-check the project.
- Manually confirm: check a Reply row → row disappears and stays gone after the pending-activities refetch and after a page reload (within the 7-day dismiss window).
