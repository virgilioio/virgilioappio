# Chat Module — Locked Implementation Plan (v5)

> Source of truth for the Chat build. Re-read this file at the start of every implementation turn. Each step lists the **only** files allowed to change. Anything outside the manifest requires re-approval.

---

## Execution discipline

### Rules the agent follows on every turn
1. Re-read this file before any edit.
2. Open every implementation turn with: **"Executing Step X.Y — files I will touch: […]"**.
3. Never modify a file not listed in the current step's `Files allowed`. If a change outside the manifest seems needed, stop and ask.
4. **Stop tokens** — halt and ask instead of guessing when any of these occur:
   - Missing product decision
   - Pre-existing bug in code the step must call
   - Naming or schema conflict with existing tables/hooks
   - Permission/RLS ambiguity
   - Anything the spec does not cover
5. Log opportunistic observations to `docs/chat/FOLLOWUPS.md`. Do not fix them in-flight.
6. After each phase ships, return to plan mode so we re-anchor before the next phase.

### Rules the user uses to keep the agent honest
- Drive **one step per turn**: *"Do Step 1.3."* Never *"Do Phase 1."*
- If a file outside the manifest is touched → reject the turn.
- If the "Executing Step X.Y…" preamble is missing → ask for a restart.

---

## Locked product decisions

- **Default chat mode per new job:** AI-first (`chat_mode='ai'`, Chat with Gio + human handoff). Recruiter can flip in the Job Wizard.
- **AI provider:** existing **OpenAI** API key. All AI calls go through one helper (`supabase/functions/_shared/chatAiClient.ts`) so the provider can be swapped later by changing a single file.
- **Retention:** **30 days soft-delete, 90 days hard-delete** after thread close. Active threads kept indefinitely. Per-tenant override allowed, never looser than 90d hard cap.
- **Access scope:** Chat module is **Owners + Admins + Recruiters only**. Hiring Managers and Interviewers see no sidebar glyph, get 404 on `/chat`, and have no chat tab on candidate profiles. "Assigned to me" = `chat_threads.assigned_recruiter_id = auth.uid()`.

---

## Phase 0 — Plan files

### Step 0.1 — Create plan docs
- **Goal:** Lock the plan and followup log into the repo.
- **Files allowed:** `docs/chat/PLAN.md`, `docs/chat/FOLLOWUPS.md`
- **DB changes:** No
- **Acceptance criteria:** Both files exist; PLAN.md contains every step below; FOLLOWUPS.md exists as an empty log.
- **Out of scope:** Any code, schema, route, or component change.

---

## Phase 1 — Foundation (recruiter side, in-app only)

### Step 1.1 — DB migration: chat tables + flags
- **Goal:** Provision tables, RLS, GRANTs, and `chat_*` columns on existing tables.
- **Files allowed:** new Supabase migration only (via `supabase--migration`).
- **DB changes:** YES — migration `chat_foundation`.
  - Create `chat_threads`, `chat_messages` (monthly partitioned parent), `chat_access_tokens`, `chat_rate_limits`, `chat_audit_log`.
  - Add `chat_enabled boolean default true`, `chat_mode text default 'ai'` to `job_postings`.
  - Add `chat_retention_days_after_close int default 30`, `chat_hard_delete_days int default 90`, `chat_ai_daily_token_cap int default 100000` to `tenants`.
  - GRANTs to `authenticated` + `service_role`. No `anon` grants on these tables.
  - RLS: SELECT requires `user_has_tenant_access(tenant_id) AND has_role(auth.uid(), ANY('owner','admin','recruiter'))`. No HM/Interviewer policies. Candidate writes only via edge functions.
- **Acceptance criteria:** Migration applies cleanly; HM/Interviewer cannot SELECT from `chat_threads`; recruiter/admin/owner can.
- **Out of scope:** Any TS code, hooks, routes, or UI.

### Step 1.2 — Permission gate + sidebar/route hide
- **Goal:** Gate the Chat module behind `canUseChat`.
- **Files allowed:** `src/hooks/usePermissions.ts`, `src/components/layout/AppSidebar.tsx`, `src/App.tsx` (route guard only).
- **DB changes:** No.
- **Acceptance criteria:** Owners/Admins/Recruiters see the Chat glyph and reach `/chat`. HM/Interviewer/Sales see no glyph; `/chat` 404s.
- **Out of scope:** Building the Chat page itself.

### Step 1.3 — Job Wizard chat toggle
- **Goal:** Master toggle + AI/Recruiter radio in Job Posting step (AI default).
- **Files allowed:** `src/components/jobs/wizard/JobPostingStep.tsx`, types file for wizard form if needed (single file).
- **DB changes:** No (uses Step 1.1 columns).
- **Acceptance criteria:** New jobs default to `chat_enabled=true, chat_mode='ai'`. Toggle persists through wizard navigation.
- **Out of scope:** Any chat runtime.

### Step 1.4 — `/chat` three-pane shell + routing
- **Goal:** Render the three-pane layout with empty panes and `/chat/:threadId` routing.
- **Files allowed:** `src/pages/Chat.tsx`, `src/components/chat/ChatShell.tsx`, `src/components/chat/ConversationListPane.tsx` (placeholder), `src/components/chat/ThreadPane.tsx` (placeholder), `src/components/chat/ContextPane.tsx` (placeholder), `src/App.tsx` (add `/chat/:threadId`).
- **DB changes:** No.
- **Acceptance criteria:** Visiting `/chat` shows three panes with canonical empty states; `/chat/:threadId` routes without errors.
- **Out of scope:** Data fetching, realtime, AI.

### Step 1.5 — Conversation list
- **Goal:** Real conversation list with scope tabs, filter chips, search, canonical empty state.
- **Files allowed:** `src/components/chat/ConversationListPane.tsx`, `src/components/chat/ScopeTabs.tsx`, `src/hooks/chat/useChatThreads.ts`.
- **DB changes:** No.
- **Acceptance criteria:** Lists real threads from `chat_threads`; All/Unread/Assigned tabs filter correctly; search by candidate/job; empty state uses `SoftBubble`.
- **Out of scope:** Thread pane internals.

### Step 1.6 — Thread pane
- **Goal:** Header, messages, day separators, bubbles, internal note block, optimistic send.
- **Files allowed:** `src/components/chat/ThreadPane.tsx`, `src/components/chat/MessageList.tsx`, `src/components/chat/MessageBubble.tsx`, `src/components/chat/DaySeparator.tsx`, `src/hooks/chat/useChatMessages.ts`, `src/hooks/chat/useSendChatMessage.ts`.
- **DB changes:** No.
- **Acceptance criteria:** Selecting a thread loads cursor-paginated messages (size 30); optimistic send adds bubble; internal notes render distinctly.
- **Out of scope:** Composer, context panel, AI.

### Step 1.7 — Composer
- **Goal:** Message / Internal note toggle, keyboard shortcuts, stub action buttons.
- **Files allowed:** `src/components/chat/Composer.tsx`.
- **DB changes:** No.
- **Acceptance criteria:** Enter sends, Shift+Enter newline; toggle switches modes; Send/Save note labels reflect mode; Attach/Calendar/Emoji rendered as disabled stubs.
- **Out of scope:** Attachments, smart compose.

### Step 1.8 — Context panel
- **Goal:** Snapshot, vertical pipeline stepper, quick actions wired to existing flows.
- **Files allowed:** `src/components/chat/ContextPane.tsx`, `src/components/chat/ContextSnapshot.tsx`, `src/components/chat/ContextStepper.tsx`, `src/components/chat/ContextQuickActions.tsx`.
- **DB changes:** No.
- **Acceptance criteria:** Schedule / Move stage / Add note open the existing in-app flows. Pipeline stepper uses `useJobHiringPlan`.
- **Out of scope:** New scheduling or notes infrastructure.

### Step 1.9 — Realtime + unread badge
- **Goal:** Realtime subscription per active thread + per-user inbox channel; sidebar unread badge.
- **Files allowed:** `src/hooks/chat/useChatRealtime.ts`, `src/hooks/chat/useChatUnreadCount.ts`, `src/components/layout/AppSidebar.tsx` (badge only).
- **DB changes:** No (uses existing materialized view if added in 1.1; else simple count query).
- **Acceptance criteria:** New message appears in <2s without refresh; unread badge increments on inbound messages and clears on read.
- **Out of scope:** AI suggestions, channel sync.

### Step 1.10 — Tenant kill switch
- **Goal:** Settings toggle "Pause all candidate chat".
- **Files allowed:** `src/pages/Settings.tsx` (or the existing workspace settings file) and one settings hook.
- **DB changes:** Single `ALTER TABLE tenants ADD COLUMN chat_paused boolean default false` migration `chat_kill_switch`.
- **Acceptance criteria:** When paused: candidate sends return 423; recruiter UI shows banner; AI replies suspended.
- **Out of scope:** Notification + retention work (Phase 4).

---

## Phase 2 — Candidate magic-link surface

### Step 2.1 — Token secret
- **Goal:** Provision `CHAT_TOKEN_SECRET`.
- **Files allowed:** none (secrets tool only).
- **Acceptance criteria:** Secret present in `secrets--fetch_secrets`.

### Step 2.2 — Token issuance on apply
- **Goal:** Issue JWT (jti hashed in `chat_access_tokens`) and email magic link on application submit.
- **Files allowed:** `supabase/functions/_shared/chatToken.ts`, edge function that handles application submission (1 file), email template (1 file).
- **DB changes:** No.
- **Acceptance criteria:** New application produces one token row + one queued email containing `/c/chat/:token`.

### Step 2.3 — `chat-token-verify`
- **Files allowed:** `supabase/functions/chat-token-verify/index.ts`, `supabase/functions/_shared/chatToken.ts` (helpers only).
- **Acceptance criteria:** Bad/expired/revoked tokens → 404. Valid → returns minimal thread session (no recruiter-only fields).

### Step 2.4 — Public candidate chat page
- **Files allowed:** `src/pages/CandidateChat.tsx`, `src/App.tsx` (public route only), `src/components/candidate-chat/*` (new dir).
- **Acceptance criteria:** `/c/chat/:token` renders AI Elements transcript + composer; no auth required.

### Step 2.5 — Candidate send/fetch edge functions
- **Files allowed:** `supabase/functions/chat-candidate-send/index.ts`, `supabase/functions/chat-candidate-fetch/index.ts`.
- **Acceptance criteria:** Rate-limited (20/5min/thread, 60/min/IP); never returns `direction='note'`; writes append-only.

### Step 2.6 — Talk to a human
- **Files allowed:** `src/components/candidate-chat/TalkToHumanButton.tsx`, edge function from 2.5 (no other files).
- **Acceptance criteria:** Click sets `status='awaiting_human'`; AI agent stops replying.

### Step 2.7 — Audit log entries
- **Files allowed:** edge functions from 2.2/2.3/2.5/2.6 only.
- **Acceptance criteria:** `chat_audit_log` rows for issue/use/revoke/handoff.

---

## Phase 3 — Gio AI on OpenAI

### Step 3.1 — `chatAiClient.ts`
- **Files allowed:** `supabase/functions/_shared/chatAiClient.ts`.
- **Acceptance criteria:** Single function exporting `chatCompletion({ messages, tools })`; reads `OPENAI_API_KEY`.

### Step 3.2 — `chat-agent-reply`
- **Files allowed:** `supabase/functions/chat-agent-reply/index.ts`, `supabase/functions/_shared/chatTools.ts`.
- **Acceptance criteria:** Replies within 10s; respects `status` (no reply when `awaiting_human` or `closed`); enforces per-tenant daily token cap; takes advisory lock per thread.

### Step 3.3 — Summarize button + summary card
- **Files allowed:** `supabase/functions/chat-ai-summarize/index.ts`, `src/components/chat/AiSummaryCard.tsx`, `src/components/chat/ThreadPane.tsx` (mount only).

### Step 3.4 — Draft with Gio
- **Files allowed:** `supabase/functions/chat-ai-draft/index.ts`, `src/components/chat/DraftWithGioPopover.tsx`, `src/components/chat/Composer.tsx` (mount only).

### Step 3.5 — Suggested replies
- **Files allowed:** `supabase/functions/chat-ai-suggest-replies/index.ts`, `src/components/chat/SuggestedReplies.tsx`, `src/components/chat/Composer.tsx` (mount only).

### Step 3.6 — Rolling context summary
- **Files allowed:** `supabase/functions/chat-agent-reply/index.ts` (only).
- **Acceptance criteria:** After every 50 new messages, `chat_threads.context_summary` is refreshed.

---

## Phase 4 — Notifications + retention + observability

### Step 4.1 — Email notifications
- **Files allowed:** new edge function `chat-notify-recipient`, `automation_email_queue` enqueue helper, two email templates.
- **Acceptance criteria:** Candidate: 1 email per 2min per thread max. Recruiter: digest after 3 messages in 10min.

### Step 4.2 — In-app bell entries
- **Files allowed:** notifications hook (1 file) + edge function from 4.1.

### Step 4.3 — Retention sweeper
- **Files allowed:** migration `chat_retention_sweeper` (cron + functions), `supabase/functions/chat-retention-sweeper/index.ts`.
- **Acceptance criteria:** Nightly job soft-deletes at +30d post-close, hard-drops partitions at +90d.

### Step 4.4 — Audit viewer + SLA widget
- **Files allowed:** `src/pages/settings/ChatAuditTab.tsx`, `src/components/dashboard/widgets/ChatSlaWidget.tsx`.

---

## Phase 5 — Channels

### Step 5.1 — Email channel
### Step 5.2 — WhatsApp channel
### Step 5.3 — "Connect a channel" CTA
- **Goal:** Surface connected/available channels on chat zero states and add a `ChatChannelsCard` in Settings → Workspace so admins can see what's live and request WhatsApp when ready.
- **Files allowed:** `src/components/chat/ChatChannelsCard.tsx` (new), `src/components/chat/ConnectChannelCTA.tsx` (new), `src/components/chat/ThreadPane.tsx` (zero state only), `src/components/chat/ConversationListPane.tsx` (empty list only), `src/components/settings/OrganizationTab.tsx` (mount card).
- **DB changes:** No.
- **Acceptance criteria:** Settings shows In-app + Email as **Active** and WhatsApp as **Coming soon** with a "Notify me" button; chat empty states link to the Settings tab; no runtime channel provisioning yet.

---

## Phase 6 — Polish (later)

Attachments UI, smart compose, templates/snippets, presence/typing.

---

## Technical reference

- **Tables**: `chat_threads(id, tenant_id, job_id, candidate_id, association_id, channel, mode, status, assigned_recruiter_id, last_message_at, last_message_preview, last_candidate_read_at, last_recruiter_read_at, message_count, archived_at, deleted_at, context_summary)`; `chat_messages` partitioned monthly with `direction in ('in','out','note')`, `sender_type`, `parts jsonb`, `read_by_recipient_at`, `redacted_at`; `chat_access_tokens` stores SHA-256 of JWT jti.
- **RLS**: SELECT requires `user_has_tenant_access(tenant_id) AND has_role(auth.uid(), ANY('owner','admin','recruiter'))`. No HM/Interviewer policies. Candidate writes only via edge functions using token auth.
- **Caching**: React Query — list 30s, unread 15s, thread realtime + cursor pagination size 30.
- **Cost guards**: per-tenant daily OpenAI token cap, per-thread advisory reply lock, 429 backpressure, max 4KB body / 5 attachments.
