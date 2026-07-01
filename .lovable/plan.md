## Problem

Candidate sends fail with HTTP 500. Edge function log:

```
[chat-candidate-send] insert failed
invalid input value for enum system_role: "recruiter"
```

The insert into `chat_messages` fires the `chat_messages_notify` AFTER INSERT trigger, which calls `public.chat_notif_recruiter_targets(thread_id)`. That function filters:

```sql
m.system_role IN ('admin','recruiter')
```

But the `public.system_role` enum only has values `admin`, `member`, `sales` (per project memory, the recruiter role was consolidated into `member`; `sales` is CRM-only). Postgres tries to cast the text literal `'recruiter'` to `system_role` and throws 22P02, aborting the whole insert.

## Fix

Single migration that replaces `chat_notif_recruiter_targets` so the role filter matches the current enum:

```sql
AND (
  m.user_type = 'workspace_owner'
  OR m.system_role IN ('admin','member')
)
```

Everything else in the function body stays identical (same signature, SECURITY DEFINER, search_path, assigned-recruiter short-circuit, notification_preferences join).

Rationale for `member` (not `sales`): sales is CRM-only and must not receive ATS chat notifications — this matches the "Sales role scope" memory.

## Verification

- Candidate sends a message from `/c/chat/:token` → 200, message row inserted, recruiter bell + email enqueued.
- No further `invalid input value for enum system_role` errors in `chat-candidate-send` logs.
- Recruiter with `system_role='member'` on the tenant receives the bell/email fanout when no `assigned_recruiter_id` is set.

## Files

- New migration under `supabase/migrations/` (created via the migration tool) — `CREATE OR REPLACE FUNCTION public.chat_notif_recruiter_targets(...)` with the corrected role list.

No frontend or edge function code changes.
