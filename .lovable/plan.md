# Phase 3 wrap-up review

I read every Phase 3 surface end-to-end: `_shared/chatAiClient.ts`, `chat-agent-reply`, `chat-ai-summarize`, `chat-ai-draft`, `chat-ai-suggest-replies`, the rolling-summary path, and the recruiter UI mounts (`AiSummaryCard`, `DraftWithGioPopover`, `SuggestedReplies`, `Composer`, `ThreadPane`). Architecture and product shape are solid. There is one **blocker** that will break every Phase 3 AI call at runtime, plus a small set of medium/low items worth fixing before we move to Phase 4.

## Findings

### Blocker — AI SDK version mismatch (will throw at module load)
All four Phase 3 functions pin `npm:ai@4`, but the code uses **v5-only** APIs:
- `stepCountIs` (v5; v4 uses `maxSteps`)
- `tool({ inputSchema })` (v5; v4 uses `parameters`)
- `@ai-sdk/openai-compatible@1` (peer-requires `ai` v5; pairing with `ai@4` breaks the provider contract)

Net effect: `chat-agent-reply` will fail on first invocation, fall through `catch`, and silently hand every candidate off to a human. `summarize`/`draft`/`suggest` will fail similarly the moment they're called.

**Fix:** bump imports in all four edge functions + `_shared/chatAiClient.ts` to `npm:ai@5`. Code is already written for v5 idioms; no surface changes needed.

### Medium — fail-soft handoff swallows real bugs invisibly
`chat-agent-reply` wraps the entire model call in a `try/catch` that flips the thread to `awaiting_human` on *any* exception with only a `console.error`. Combined with the blocker above, an outage would look like "AI keeps handing off" rather than "AI is broken".

**Fix:**
- Tag `chat_audit_log.metadata.reason` with the exception class + first 200 chars (already partly done — promote to a structured `{ kind, message, stack_head }`).
- Add a tenant-scoped counter (`chat_ai_fail_soft_handoff` per hour) and surface a console warning when >N in a window so we notice in logs.
- Distinguish *expected* fail-soft (`daily_cap`, `empty_reply`) from *unexpected* (`exception`) in the audit event name.

### Medium — token reserve charges tenants for failed calls
`chat_consume_ai_tokens` reserves `CHAT_TOKEN_CAPS.*` up front. If `generateText` throws, we never refund. Tenants get charged ~600–1200 tokens for nothing on every failure.

**Fix:** on exception (and on `empty_reply` / `empty_draft` / `empty_summary`), call `chat_consume_ai_tokens` with the negative delta (or add a `chat_refund_ai_tokens` RPC) to roll back the reserve. Keep the audit log entry.

### Medium — rolling-summary trigger uses wrong counter
`maybeRefreshRollingSummary` compares `chat_threads.message_count` (which counts *all* messages including system notes and recruiter notes) against the summary's stored count. That means recruiter "Add note" actions count toward the 50-message refresh budget, and the actual conversation can drift further than intended before a refresh fires. The summary itself correctly filters notes out — only the trigger threshold is off.

**Fix:** either (a) base the refresh threshold on `count(*) where direction != 'note'` for that thread, or (b) add a `chat_threads.candidate_visible_message_count` column maintained by trigger and key off that. Option (b) is cleaner long-term.

### Medium — `chat-ai-summarize` cache treats rolling summaries as user-triggered
The 5-message cache window also returns rolling summaries (which are bullet-format) when the recruiter clicks "Summarize". The two formats are different on purpose: rolling is 4–8 bullets for the agent; the card is ~120-word prose.

**Fix:** include `source` in the cached payload check. If `cached.source === "rolling"`, treat it as a miss for recruiter-triggered summaries and generate fresh prose. Persist with `source: "card"`.

### Low — internal dispatch from `chat-candidate-send` is fire-and-forget with no retry
If the dispatch fetch itself errors (network blip, cold start timeout), the candidate sees their message land but Gio never replies and the thread never flips to awaiting_human. Today the only recovery is the next candidate message.

**Fix (minimal):** wrap dispatch in `Promise.race` against a short timeout, and on dispatch failure post a system message ("A teammate will jump in shortly.") + audit `chat_dispatch_failed`. Avoid building a queue for now — Phase 4 may add one.

### Low — `suggest-replies` has no debounce/cooldown
The popover triggers on-demand per the spec, but nothing stops a recruiter clicking "Refresh" 20×/min. The tenant cap will catch abuse eventually, but it's pricey.

**Fix:** add a soft per-thread cooldown (e.g. 10s) using `chat_rate_limits` (already exists) before the model call. Return `{ suggestions: [], reason: "cooldown_ms" }` so the UI can show a friendly hint.

### Low — provider name + structured-outputs flag are correct, just unused
`structuredOutputs` toggle is exposed on `getChatAi` but no Phase 3 caller uses it. That's fine, just noting it's untested. Phase 4 (`get_job_details` could become structured) will exercise it.

### Low — `chat-ai-draft` and `summarize` skip the rolling-summary refresh path
The rolling summary only refreshes inside `chat-agent-reply`. If a thread is in recruiter mode (AI off) for a long stretch, the summary goes stale and the next AI takeover sees outdated background.

**Fix:** when `chat-ai-summarize` writes a `source: "card"` summary, also stamp `message_count` so the rolling trigger respects it. The 50-message gate already keys off that field, so this is essentially free.

## Recommended order to fix

1. **Blocker:** bump `npm:ai@4` → `npm:ai@5` across `chatAiClient.ts` and all four chat-ai functions; confirm `@ai-sdk/openai-compatible@1` resolves cleanly.
2. **Medium:**
   - Refund-on-failure for `chat_consume_ai_tokens`.
   - Distinguish exception vs expected fail-soft in `chat_audit_log.event`.
   - Switch rolling-summary trigger to candidate-visible message count.
   - Cache-key the recruiter summary card on `source: "card"`.
3. **Low:**
   - Dispatch-failure system message + audit in `chat-candidate-send`.
   - Suggest-replies cooldown via `chat_rate_limits`.
   - Stamp `message_count` on card-source summaries.

## Out of scope for this wrap-up
- Phase 4.1 (handoff UX, recruiter takeover UI) — separate plan.
- Adding new tools (`request_reschedule`, `share_recruiter_calendar`) — Phase 4.2.
- Streaming the candidate-facing reply — currently `generateText`; Phase 4 may move to `streamText` for perceived latency.

Once you approve, I'll switch to build mode and land the blocker + Medium items in one pass, then Low items in a follow-up so the diff stays reviewable.
