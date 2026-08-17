# Fix: dismissed "Your queue" items come back

## What I found in the code

Two concrete problems, both confirmed by reading `src/pages/Dashboard.tsx` and `src/hooks/usePendingActivities.ts`:

1. **Dismissals only live in the browser.** They are written to `localStorage` under `dashboard.queue.dismissed.<userId>` with a 7-day expiry. Nothing is stored server-side. So a dismissal is lost whenever the browser storage isn't the same one: different device, different browser, incognito, cleared site data, or the preview origin vs. the published domain. It also silently expires after 7 days, which by itself makes items reappear.

2. **"Reply needed" rows are keyed by a row id that can change.** Each queue item's key is derived from a database row id (`e-<email_logs.id>`, `s-<booking.id>`, `d-<association.id>`, `a-<association.id>`). Scorecard/decision/application keys are stable, but inbound emails can exist as several `email_logs` rows for the same message (Gmail sync + inbound webhook) — the hook already de-duplicates them by `rfc822_message_id` at read time. Which duplicate wins can change between refetches, so the same real email can come back under a different key even when the old key is still marked done.

## The fix

Move dismissals to the database and key them by a stable *semantic* identity instead of a row id.

1. **New table `dashboard_queue_dismissals`** — one row per (user, item key): `user_id`, `tenant_id`, `item_key`, `dismissed_at`. Unique on (user_id, item_key). RLS + grants so each user reads/writes only their own rows.

2. **Stable item keys.** Replace row-id keys with keys built from the underlying entity:
   - scorecard: `scorecard:<associationId>:<stageInstanceId>:<interviewerId>`
   - decision: `decision:<associationId>:<stageInstanceId>`
   - application: `application:<associationId>`
   - reply: `reply:<rfc822_message_id>` when present, else `reply:<email_logs.id>`
   The reply key is what kills the "comes back under a new id" case, since all duplicates of an email share the message id.

3. **Read/write path.** A `useQueueDismissals` hook loads the user's dismissed keys (react-query) and exposes optimistic `dismiss` / `undo` mutations. The dashboard filters `rawQueue` by that set. Checking a row is instant (optimistic) and survives reload, device change and re-login.

4. **Keep the existing side effects.** Marking a "reply" row done still calls `markEmailAsRead` exactly as today. Nothing else about queue building, sorting, counts, filters or row rendering changes.

5. **Expiry.** Drop the silent 7-day client expiry: an item stays hidden until the underlying work actually disappears from the source query (scorecard submitted, stage moved, email read). Optionally prune rows older than 90 days later — not needed for correctness.

6. **One-time migration of existing local state.** On first load after the change, any keys still in `localStorage` are upserted to the new table (best effort, then the local key is cleared) so users don't see a flood of previously-cleared items.

## Verification

- Check off items, hard reload → they stay gone.
- Check off a reply, let the Gmail sync run → row does not resurface.
- Open the dashboard in a second browser as the same user → the same items are hidden.
- Undo a checked row → it reappears immediately and stays back after reload.

## Technical notes

- Files: new migration, new `src/hooks/useQueueDismissals.ts`, edits to `src/pages/Dashboard.tsx` (key construction in `buildQueue`, remove the localStorage persistence block, wire the hook) and small additions in `src/hooks/usePendingActivities.ts` / `useNewApplicationsQueue.ts` to expose the fields the stable keys need (`rfc822_message_id`, `stageInstanceId`, `interviewerId`, `associationId`).
- No change to permissions, queue data sources, or the email read mutation.
