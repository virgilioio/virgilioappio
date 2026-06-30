
# Phase 4.1 — Candidate + recruiter chat email notifications

## Why a chat-owned queue (not `automation_email_queue`)

`automation_email_queue` enforces `stage_automation_email_id NOT NULL` and `job_candidate_association_id NOT NULL`, both with FK cascade, and its RLS scopes by JCA. Chat notifications (new candidate message → recruiters, AI handoff → recruiters, recruiter reply → candidate) often have no JCA and never have a stage-automation email. Bolting them on means nullable FKs, mixed-purpose RLS, and a confusing processor.

The cleaner move is a dedicated `chat_notification_queue` that **reuses the same discipline** (single processor on pg_cron, status enum, retry/error tracking, throttle window) and sends through the existing Resend infra. No new domain setup — `app.gogio.io` is already verified.

## What 4.1 ships

Three notification kinds, all queue-driven:

| kind                       | recipient                                    | trigger                                                                |
| -------------------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| `recruiter_new_message`    | recruiters with thread access (members)      | candidate posts an inbound message                                     |
| `recruiter_handoff`        | recruiters with thread access (members)      | AI fail-soft or candidate "Talk to a human" flips thread to `awaiting_human` |
| `candidate_recruiter_reply`| candidate email                              | recruiter sends an outbound reply while candidate has no live polling session |

### Throttling + digesting (the important part)

- **Per-recipient throttle window.** While a notification for a given `(thread_id, recipient)` is `pending` *or* was `sent` within the last `THROTTLE_MINUTES` (default 10), subsequent enqueues for the same pair coalesce into the existing row instead of creating a new one — `message_count++`, `last_message_at = now()`, `scheduled_for` left as-is. That's the digest: one email per thread per recipient per window, summarizing N messages.
- **First message goes out fast.** The first enqueue per window is scheduled for `now() + DIGEST_DELAY_SECONDS` (default 60s) so a burst of two-three quick messages still collapses into one send.
- **Suppressed if already read.** Right before the processor sends, it checks `chat_thread_reads` for that recipient/thread; if they've read past the last queued message we mark the row `cancelled` and skip the email. Same for `recruiter_handoff` if a teammate already grabbed the thread.

### Recipient resolution

- Recruiter targets resolve from `thread_assignees` (when present) → fallback to all `members` on the thread's tenant with role `recruiter`/`admin`/`workspace_owner` who have `notification_preferences.chat_email_enabled = true`. New pref column, defaults to `true`.
- Candidate target is `candidates.email` from the thread's `candidate_id`. Skipped if no email or if email is on `email_suppression_list`.

## Schema (one migration)

```sql
-- enum
create type chat_notification_kind as enum (
  'recruiter_new_message',
  'recruiter_handoff',
  'candidate_recruiter_reply'
);
create type chat_notification_status as enum ('pending','sent','cancelled','failed');

-- queue
create table public.chat_notification_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  kind chat_notification_kind not null,
  recipient_user_id uuid,          -- recruiter target (members.user_id)
  recipient_email   text,          -- candidate target (lowercased)
  scheduled_for timestamptz not null,
  status chat_notification_status not null default 'pending',
  message_count int not null default 1,
  last_message_id uuid,
  last_message_at timestamptz not null default now(),
  attempts int not null default 0,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- one open row per (thread, kind, recipient)
create unique index chat_notif_q_open_uidx
  on public.chat_notification_queue (thread_id, kind, coalesce(recipient_user_id::text, recipient_email))
  where status = 'pending';
create index chat_notif_q_due_idx
  on public.chat_notification_queue (status, scheduled_for) where status = 'pending';

-- RLS: tenant-scoped read for members; service_role writes
-- (full grants + policies in the migration)

-- enqueue RPC (SECURITY DEFINER): atomically coalesces or inserts
create function public.chat_notif_enqueue(
  p_tenant uuid, p_thread uuid, p_kind chat_notification_kind,
  p_user uuid, p_email text, p_message_id uuid,
  p_throttle_seconds int default 600, p_delay_seconds int default 60
) returns uuid ...

-- new notification preference column
alter table public.notification_preferences
  add column if not exists chat_email_enabled boolean not null default true;
```

## Edge functions (Resend-backed)

1. `chat-notify-enqueue` (internal, header `x-internal-secret`) — called by `chat-candidate-send`, `chat-agent-reply` (on handoff), and `chat-recruiter-send` (for candidate emails). Resolves recipients then calls the `chat_notif_enqueue` RPC per recipient. Idempotent.
2. `chat-notification-processor` — every minute via `pg_cron`. Pulls due `pending` rows (batch 25), runs cancel checks (read receipts, taken-over threads, suppression list), renders the appropriate React Email template, sends via Resend through the gateway (`Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${RESEND_API_KEY}`), then marks `sent` / increments `attempts` and re-schedules on transient failure (max 5 attempts → `failed`). `From: Gio <chat@app.gogio.io>` (already verified domain). `Reply-To` for recruiter emails deep-links the recruiter inbox; candidate emails set `Reply-To` to a non-monitored address with a "Open chat" CTA back to the magic-link surface.
3. Three React Email templates under `supabase/functions/_shared/chat-email-templates/`:
   - `recruiter-new-messages.tsx` — "N new messages from {candidate}" + last excerpt + CTA to thread.
   - `recruiter-handoff.tsx` — "Gio handed off {candidate} — needs a human" + reason.
   - `candidate-recruiter-reply.tsx` — "{recruiter} replied" + excerpt + "Open chat" magic-link CTA (reuses existing token surface).

## Wiring (call sites)

- `chat-candidate-send` → after successful insert, fire-and-forget `chat-notify-enqueue` with `kind=recruiter_new_message`.
- `chat-agent-reply` → in `failSoftHandoff` and on `request_human_handoff` tool execution, enqueue `recruiter_handoff`.
- New `chat-recruiter-send` integration (or wherever recruiter outbound currently inserts) → enqueue `candidate_recruiter_reply` only when the candidate hasn't been seen polling in the last 2 minutes (`chat_threads.candidate_last_seen_at`).

## Cron + secret check

- `pg_cron` job `chat-notification-processor` every minute, invoking the function via existing service-role secret pattern (same as `process-email-queue`).
- Confirms `LOVABLE_API_KEY` + `RESEND_API_KEY` already present (they power existing transactional email). No new secrets to ask the user for.

## Out of scope for 4.1 (later in Phase 4)

- 4.2 in-app bell notifications — separate write to `notifications`.
- 4.3 retention sweeper.
- 4.4 audit viewer + SLA widget.

## Acceptance

- Burst of 5 candidate messages within 1 minute → 1 recruiter email arrives ~60s after the first, subject reads "5 new messages from …".
- Recruiter opens the thread before send → row flips to `cancelled`, no email sent.
- AI fail-soft handoff → recruiters get a distinct `Needs a human` email (not coalesced with new-message digest).
- Candidate without an email address or on suppression list → row flips to `cancelled` with reason, no Resend call.
- Resend 5xx → row stays `pending`, `attempts++`, next minute retried; after 5 attempts → `failed` with error captured.
