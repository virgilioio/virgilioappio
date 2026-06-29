# Phase 1 — Chat Foundation Audit

Review only. No code changes proposed here — this confirms what's shipped and flags the gaps a senior engineer would close before calling Phase 1 "done."

## Step-by-step verification

| # | Item | Status | Evidence |
|---|---|---|---|
| 1.1 | `chat_threads`, partitioned `chat_messages`, `chat_access_tokens`, `chat_rate_limits`, `chat_audit_log`, `job_postings.chat_enabled/chat_mode`, `tenants.chat_retention_*`, RLS + GRANTs | ✅ | `20260629231422_…sql` + realtime publication migration |
| 1.2 | `canUseChat` gate + sidebar/route hide | ✅ | `useCanUseChat`, `ChatRouteGuard` in `App.tsx`, `AppSidebar.tsx` filter |
| 1.3 | Wizard "Candidate chat" master toggle + AI/Recruiter radio | ✅ | `JobPostingStep.tsx` SectionCard + persistence on `chat_enabled/chat_mode` |
| 1.4 | `/chat` three-pane shell + `/chat/:threadId` routing | ✅ | `pages/Chat.tsx`, route pair registered |
| 1.5 | ConversationList (scope tabs, filters, search, empty state) | ✅ | `ConversationListPane.tsx` + `ScopeTabs.tsx` + `useChatThreads.ts` |
| 1.6 | Thread pane (header, messages, day separators, bubbles, internal notes, optimistic) | ✅ | `ThreadPane.tsx`, `MessageList.tsx`, `MessageBubble.tsx`, `DaySeparator.tsx` |
| 1.7 | Composer (Reply/Note toggle, Enter/Shift+Enter, disabled stubs) | ✅ | `Composer.tsx` + `useSendChatMessage.ts` |
| 1.8 | Context panel (Snapshot, Stepper, Quick actions) | ✅ | `ContextPane.tsx`, `ContextSnapshot.tsx`, `ContextStepper.tsx`, `ContextQuickActions.tsx` |
| 1.9 | Realtime + unread badge | ✅ | `useChatRealtime.ts`, `useChatUnreadCount.ts`, sidebar pill |
| 1.10 | Tenant kill switch | ✅ | `tenants.chat_paused`, `useChatKillSwitch.ts`, `OrganizationTab.tsx`, banner in `ThreadPane` |

All ten checklist items are present in code and DB. Phase 1 acceptance scope is materially complete.

## Senior-engineer gaps to fix before Phase 2

These don't block the checklist but a careful reviewer would flag them now:

1. **Partition runway is finite.** Migration pre-creates `chat_messages_2026_05..08`. After Aug 2026 inserts will fail. Need a scheduled `pg_cron` job (or edge cron) calling a `create_chat_message_partitions(months_ahead int)` function monthly.
2. **`last_message_at` / `last_message_preview` are not maintained.** `chat_threads` has the columns and an index on them, but no trigger updates them on insert into `chat_messages`. The conversation list ordering and previews will drift / stay null.
3. **Unread is recruiter-global, not per-recruiter.** `useChatUnreadCount` compares `last_message_at` to a single `last_read_at` on the thread. Two recruiters sharing a thread will clear each other's badge. Needs a `chat_thread_reads(thread_id, user_id, last_read_at)` table (or JSON map) before multi-recruiter inboxes ship.
4. **Kill switch is UI-only.** `chat_paused` disables the composer in React but there is no DB-level guard. An RLS predicate or `BEFORE INSERT` trigger on `chat_messages` should reject sends when `tenants.chat_paused = true`, otherwise a stale tab or future candidate endpoint bypasses it.
5. **`chat_mode` / `chat_enabled` are stored per posting but never read at thread creation.** Nothing today refuses to create a thread when a job's chat is disabled, and `chat_mode='ai'` has no behavioural branch yet (expected for Phase 2/3, but should at least be surfaced as a thread-level snapshot column to avoid retroactive mode changes).
6. **No audit writes.** `chat_audit_log` table exists with RLS but no code path inserts into it (send, internal note, kill-switch toggle, thread assignment). Compliance story is incomplete.
7. **Rate limit table is unused.** `chat_rate_limits` exists; `useSendChatMessage` does not consult or increment it. Recruiter side is low-risk, but the table should at least be wired for internal-note/send to validate the schema before candidate side opens.
8. **Realtime payload trust.** `REPLICA IDENTITY FULL` is set, but `useChatRealtime` should still re-fetch via RLS-scoped query rather than trusting the payload row directly (defence in depth if RLS ever regresses).
9. **Retention defaults exist, enforcement does not.** `chat_retention_days_*` columns are added on `tenants` but no purge job/edge function reads them. Should at minimum land a stub edge function + cron registration so retention is visible in ops.
10. **Tests.** No Deno tests for the RLS policies on `chat_messages` / `chat_threads` / `chat_audit_log`. Given the cross-tenant blast radius, a small `*_test.ts` proving "user in tenant A cannot read tenant B's messages" should land before Phase 2 adds the candidate surface.

## Suggested next move

Before starting Phase 2 (candidate-side magic link, AI auto-reply), close items **1, 2, 3, 4, 6** at minimum — they are foundational and cheaper to fix now than after the candidate channel is live. Items 5, 7, 8, 9, 10 can be tracked as Phase 1.5 hardening.

Say the word and I'll turn the must-fix subset into a Phase 1.5 plan.
