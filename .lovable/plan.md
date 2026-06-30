
# Phase 4 — Recap & senior review

## What's in place (verified end-to-end)

**4.1 — Email notifications**
- Dedicated `chat_notification_queue` (separate from `automation_email_queue` so chat throttling doesn't compete with onboarding/marketing-style sends).
- `chat_notif_enqueue` RPC + DB triggers (`chat_messages_notify`, `chat_threads_notify_handoff`) auto-queue on every new message and on handoff status transitions.
- 10-minute digest coalescing (`message_count` + `last_message_*`) before send.
- `chat-notification-processor` edge function: batch 25, attempts/backoff (5min × 5), suppression list re-check, "already read" / "candidate active" / "thread handled" cancellations, Resend send with `EMAIL_DEFAULT_FROM` fallback to `chat@app.gogio.io`.
- pg_cron `chat-notification-processor` runs every minute (verified active).
- Triggers attached to all current chat_messages monthly partitions (2026_05 → 2026_09).

**4.2 — In-app bell**
- `chat_message` notification category in `notification_preferences` (in-app on, email on, push off).
- `chat_bell_enqueue` RPC coalesces repeats per (thread, recipient) so one thread = one unread bell entry.
- `NotificationCenter` renders the category with the purple "CHAT" chip and links to `/chat/{threadId}`.
- Respects each recruiter's per-channel toggle.

**4.3 — Retention sweeper**
- `chat-retention-sweeper` edge function orchestrates: closed-job purge → 30d soft-archive → 90d hard-delete → partition drop (keep last 4 months) → opportunistic rate-limit/audit/token cleanup.
- Tenant-tunable windows (`chat_inactivity_soft_delete_days`, `chat_hard_delete_days`).
- pg_cron `chat-retention-sweeper` runs nightly 03:20 UTC (verified).
- `chat-messages-create-partitions` continues to roll forward partitions monthly.

**4.4 — Admin observability**
- `chat_audit_log` RLS restricts reads to admins / workspace owners (verified policy).
- `AdminChatAuditViewer` sheet: 200 most recent events, event filter, search, tone-mapped badges, JSON metadata, mounted in the chat list header (admin-only).
- `ChatSlaWidget` + `useChatSlaMetrics`: awaiting-human count + oldest age, median / p95 first-response over last 7 days, refreshed every 60s, capped to 1k messages.

---

## Audit findings — issues to fix in this pass

### F1 (bug, blocking the SLA widget). Direction values mismatch
`useChatSlaMetrics.ts` filters on `direction === 'inbound'` / `'outbound'`, but the database stores `'in'` / `'out'` (confirmed in `chat-candidate-send`, `chat-agent-reply`, `useChatMessages`). Result: the latency loop never collects samples — median/p95 always render as `—`.

Fix: change the two comparisons to `'in'` and `'out'`. Also add a defensive `direction.startsWith('in')` if we keep both representations.

### F2 (correctness, small). Oldest-awaiting clock
Widget computes oldest awaiting age from `chat_threads.updated_at`, which moves on any thread-row change (e.g. `context_summary` refresh). Use `last_message_at` instead — it more accurately reflects "how long has the candidate been waiting".

### F3 (defensive). Add explicit ordering by `created_at` in `useChatSlaMetrics`
We currently order by `thread_id, created_at` so per-thread arrays remain chronological — but Supabase chains the two `.order(...)` calls correctly; verify and add a comment. No code change beyond a comment unless `EXPLAIN` shows otherwise.

### F4 (observability gap). Retention sweeper has no audit row
Successful sweeper runs aren't reflected in `chat_audit_log`, so admins can't see "last cleaned at X, removed Y threads". Add a single `system`-actor audit insert at the end of `chat-retention-sweeper` with `{ purged, soft_archived, hard_deleted, partitions_dropped }` counts pulled from the RPC results. Cheap, one row per night, very useful when debugging retention questions.

### F5 (resilience). Notification processor cancellation typo-tolerance
`shouldCancel` uses `email_suppression_list` (`.ilike("email", row.recipient_email)`). `ilike` without `%` wildcards is just case-insensitive equality — that's fine, but flag it as `.eq` with `email.toLowerCase()` for clarity and to avoid future regex-style confusion. Behavior identical.

### F6 (housekeeping). Document the worker contract
Add a one-paragraph header to `chat-notification-processor` and `chat-retention-sweeper` documenting:
- Invocation source (`pg_cron`, anon apikey)
- Concurrency assumptions (single-runner; processor selects `pending` ordered + limit 25 — safe even on overlap because rows flip to `sent`/`failed` immediately).
- Retry semantics (5min × 5 attempts → `failed`).

No code shape change; just inline docs for the next on-call engineer.

---

## What I deliberately did NOT change

- Queue table choice. Keeping `chat_notification_queue` separate from `automation_email_queue` is the right call: chat is high-volume + needs digesting + per-thread cancellation; mixing into the general queue would force generic schemas and complicate suppression rules. Revisit only if we later need a single observability pane across all email senders.
- `verify_jwt = true` on workers. Both worker functions stay JWT-verified; pg_cron passes the anon key. This is the supported pattern and keeps Resend keys out of any unauthenticated path.
- SLA sample cap of 1k messages / 7 days. Adequate for current volumes; revisit once any tenant exceeds ~1k inbound chat msgs per week (we'll switch to a materialized SLA snapshot computed by the nightly sweeper).

---

## Plan of execution (small, self-contained)

```text
1. Fix F1: useChatSlaMetrics.ts — change 'inbound'/'outbound' → 'in'/'out'.
2. Fix F2: switch oldest-awaiting clock to last_message_at + fallback to updated_at.
3. F4: append audit row in chat-retention-sweeper after RPC stage, with totals.
4. F5: replace .ilike with .eq(lowercased) in chat-notification-processor.
5. F6: header docstrings on both worker functions.
6. Smoke: curl chat-retention-sweeper once, confirm `results` array + new audit row;
         open chat as admin, confirm ChatSlaWidget now shows median/p95 (or sampleSize=0
         only when truly no recruiter replies).
```

No DB migration needed — all fixes are code-only.

After this pass Phase 4 is closed and we can move to Phase 5 with clean observability.
