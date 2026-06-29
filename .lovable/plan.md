# Chat Module — Locked Plan v5 (with execution discipline)

## Execution discipline (new — applies to the entire Chat build)

Before any code, **Step 0** creates two repo files that govern the rest of the build:

- **`docs/chat/PLAN.md`** — the locked plan below, broken into numbered steps. Each step has:
  - `Goal:` one sentence
  - `Files allowed:` exhaustive manifest (anything outside requires re-approval)
  - `DB changes:` yes/no (+ migration name)
  - `Acceptance criteria:` what must be true when the step is done
  - `Out of scope:` explicit "do not touch" list
- **`docs/chat/FOLLOWUPS.md`** — empty stub. Anything I notice outside the current step's manifest gets logged here instead of fixed.

### Rules I will follow on every turn
1. Re-read `docs/chat/PLAN.md` at the start of each implementation turn.
2. Open with: **"Executing Step X.Y — files I will touch: […]"** before any edit.
3. Never touch a file not in the current step's manifest. If I need to, I stop and ask.
4. **Stop tokens** — if any of these appear, I halt and ask instead of guessing:
   - Missing product decision
   - Pre-existing bug in code I need to call
   - Naming/schema conflict with existing tables or hooks
   - Permission/RLS ambiguity
   - Anything the spec doesn't cover
5. Log opportunistic observations to `FOLLOWUPS.md`, never fix them in-flight.
6. After each phase ships, I return to plan mode so we re-anchor before the next phase.

### Rules you'll use to keep me honest
- Drive me **one step per turn**: *"Do Step 1.3."* Don't say *"do Phase 1."*
- If I edit a file not in the manifest, reject the turn and point at the manifest.
- If I skip the "Executing Step X.Y…" preamble, ask me to restart the turn.

---

## Locked product decisions (from v4)

- **Default chat mode per new job:** AI-first (`chat_mode='ai'`, Chat with Gio + human handoff). Recruiter can flip in the Job Wizard.
- **AI provider:** Existing **OpenAI** API key. All AI calls isolated behind one server helper (`_shared/chatAiClient.ts`) so we can swap to Lovable AI Gateway later by changing one file.
- **Retention:** **30 days soft-delete, 90 days hard-delete** after thread close. Active threads kept indefinitely. Per-tenant override allowed, never looser than 90d hard cap.
- **Access scope:** Chat module is **Owners + Admins + Recruiters only**. Hiring Managers and Interviewers see no sidebar glyph, get 404 on `/chat`, and have no chat tab on candidate profiles. "Assigned to me" = `chat_threads.assigned_recruiter_id = auth.uid()`.

---

## Phasing (one phase = one approval gate; one step = one turn)

### Phase 0 — Plan files (Step 0.1)
Create `docs/chat/PLAN.md` and `docs/chat/FOLLOWUPS.md`. No code, no DB.

### Phase 1 — Foundation, recruiter side, in-app only
- 1.1 DB migration: `chat_threads`, `chat_messages` (monthly partitioned), `chat_access_tokens`, `chat_rate_limits`, `chat_audit_log`; add `chat_enabled`/`chat_mode` to `job_postings`; add `chat_retention_*` defaults `30`/`90` to `tenants`. Full RLS + GRANTs.
- 1.2 `canUseChat` permission gate in `usePermissions.ts`; hide sidebar Chat glyph and `/chat` route for non-eligible roles.
- 1.3 Job Wizard "Candidate chat" section in `JobPostingStep.tsx`: master toggle + AI/Recruiter radio (AI default).
- 1.4 `/chat` three-pane shell + URL routing `/chat/:threadId` (empty panes, no data yet).
- 1.5 `ConversationList` (scope tabs, filter chips, search, canonical empty state).
- 1.6 Thread pane (header, messages, day separators, bubbles, internal note block, optimistic send).
- 1.7 Composer (Message / Internal note toggle, Enter / Shift+Enter, Send / Save note; Attach/Calendar/Emoji as disabled stubs).
- 1.8 Context panel (Snapshot, Pipeline stepper, Quick actions wired to existing flows).
- 1.9 Realtime: per-thread + per-user inbox channels; unread badge on sidebar glyph.
- 1.10 Kill switch in tenant Settings → "Pause all candidate chat".

### Phase 2 — Candidate magic-link surface
- 2.1 `CHAT_TOKEN_SECRET` via `generate_secret`.
- 2.2 Token issuance on application submit; magic-link email to `/c/chat/:token`.
- 2.3 `chat-token-verify` edge function (Zod, rate-limited, anti-enumeration 404).
- 2.4 Public `/c/chat/:token` page using AI Elements (Conversation, Message, PromptInput, Shimmer).
- 2.5 `chat-candidate-send` / `chat-candidate-fetch` edge functions.
- 2.6 "Talk to a human" button → `status='awaiting_human'`.
- 2.7 Audit log entries on token issue/use/revoke.

### Phase 3 — Gio AI on OpenAI
- 3.1 `_shared/chatAiClient.ts` (OpenAI isolation layer).
- 3.2 `chat-agent-reply` edge function: system prompt, tools (`request_human_handoff`, `schedule_interview_link`, `get_job_details`), advisory lock, daily tenant token cap, fail-soft handoff.
- 3.3 Summarize button + AI summary card.
- 3.4 Draft with Gio popover (Insert / Regenerate).
- 3.5 Suggested replies chip row.
- 3.6 Context summarization rolling every 50 messages.

### Phase 4 — Notifications + retention + observability
- 4.1 Candidate + recruiter emails via `automation_email_queue` (throttled / digested).
- 4.2 In-app bell notification entries.
- 4.3 `chat-retention-sweeper` pg_cron (30d soft, 90d hard); partition drop for hard delete.
- 4.4 Admin-only audit log viewer; SLA dashboard widget.

### Phase 5 — Channels (Email then WhatsApp)
- 5.1 Email channel via existing mail identities, outbound `noreply@app.gogio.io`, open-pixel receipt.
- 5.2 WhatsApp provider integration (separate spec), webhook → inbound, delivery/read receipts.
- 5.3 "Connect a channel" CTA in zero state + Settings.

### Phase 6 — Polish (later)
Attachments UI, smart compose, templates/snippets, presence/typing.

---

## Technical details (for engineers; safe to skim)

- **Tables**: `chat_threads(id, tenant_id, job_id, candidate_id, association_id, channel, mode, status, assigned_recruiter_id, last_message_at, last_message_preview, last_candidate_read_at, last_recruiter_read_at, message_count, archived_at, deleted_at, context_summary)`; `chat_messages` partitioned monthly with `direction in ('in','out','note')`, `sender_type`, `parts jsonb`, `read_by_recipient_at`, `redacted_at`; `chat_access_tokens` storing SHA-256 of JWT jti.
- **RLS**: SELECT requires `user_has_tenant_access(tenant_id) AND has_role(auth.uid(), ANY('owner','admin','recruiter'))`. No HM/Interviewer policies. Candidate writes only via edge functions.
- **Caching**: React Query — list 30s, unread 15s, thread realtime + cursor pagination size 30. Materialized `chat_unread_counts_mv`.
- **Cost guards**: Per-tenant daily OpenAI token cap, per-thread reply lock, 429 backpressure, max 4KB body / 5 attachments.

---

## What I need from you to start
Just say **"Do Step 0.1"** and I'll create the two plan files. Nothing else.
