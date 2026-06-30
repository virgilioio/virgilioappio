# Phase 1 + 2 Hardening Review

A targeted pass before Phase 3. No new features — just close the gaps a senior review would flag now, while the surface area is still small and easy to fix.

## What's solid (leave alone)

- Token crypto: HMAC-SHA256 + constant-time compare + `jti_hash` only at rest.
- Anti-enumeration: every auth-shaped failure returns the same `404 not_found`.
- Shared `authenticateCandidateRequest` helper — send/fetch/handoff all use the same gate.
- Recruiter revoke is idempotent and tenant-scoped via `members`.
- Partitioned `chat_messages` with `pg_cron` partition management (Phase 1.5).
- RLS isolation tests (`chat-rls.test.ts`) cover the recruiter side.

## Issues to fix

### H1 — Rate limit race condition (correctness)
`bumpRateLimit` in `_shared/chat-candidate-auth.ts` (and the inline copy in `chat-token-verify`) does `select → check → update/insert` from JS. Under concurrent requests the same bucket gets read at N-1 by two callers and both pass. The verify limiter has the same shape.

**Fix:** Replace with a single SECURITY DEFINER SQL function `public.chat_bump_rate_limit(scope, key, window_seconds, max)` that does an `INSERT ... ON CONFLICT (scope, scope_key, window_start) DO UPDATE SET count = chat_rate_limits.count + 1 RETURNING count`, then compares in SQL. Atomic, one round-trip, and removes the duplicate logic in `chat-token-verify/index.ts` (it can call the shared helper too).

Requires a unique index on `(scope, scope_key, window_start)` — add if missing.

### H2 — Token rotation invalidates live candidate sessions (regression risk)
`issueCandidateChatToken` revokes **all** prior active tokens on every call. The intended caller today is `public-submit-application` (once per application), but any future caller — resend-magic-link, recruiter "regenerate", retry-on-error — will silently kick the candidate out of an open browser tab.

**Fix:** If an active, non-revoked, non-expired token already exists for the (tenant, candidate, thread), and the caller did not pass `forceRotate: true`, return the existing thread + `{ reused: true }` and skip minting. Email send path stays the same (we just don't have a raw token to email — surface that to the caller so it can decide whether to re-send the link or no-op). For the application-submit path, pass `forceRotate: true` to preserve current behaviour.

### H3 — Retention / unbounded growth (cost + privacy)
Three tables grow forever today:
- `chat_rate_limits` — every IP-bucket window persists.
- `chat_audit_log` — every verify failure (incl. scanners) writes a row.
- `chat_access_tokens` — revoked rows accumulate.

**Fix:** One migration adds a `pg_cron` job (daily 03:10 UTC) that runs:
- `delete from chat_rate_limits where window_start < now() - interval '2 days';`
- `delete from chat_audit_log where created_at < now() - interval '180 days';`
- `delete from chat_access_tokens where revoked_at < now() - interval '30 days' or (expires_at < now() - interval '30 days' and revoked_at is null);`

Also add a tiny per-(ip, minute) cap on `chat_token_verify_failed` audit inserts so a scanner can't fill the table between sweeps (the plan called for this in 2.3 but it was never wired).

### H4 — `chat-token-verify` duplicates the candidate auth logic
The endpoint reimplements the DB cross-check / posting gate / tenant lookup that `_shared/chat-candidate-auth.ts` already does. Easy to drift.

**Fix:** Extract the shared body into `verifyCandidateTokenAndResolveContext(req, token)` in `_shared/chat-candidate-auth.ts` (it already returns the same shape). `chat-token-verify` becomes a thin wrapper that adds the candidate-display + job-title enrichment and returns the public payload. No behaviour change, ~80 fewer lines, one source of truth.

### H5 — Posting selection is ambiguous
Both `chat-token.ts` (issue) and the auth helper (verify) do `from('job_postings').eq('job_id', X).order('created_at', desc).limit(1)`. If a job ever has multiple postings (draft + active), we may pick the wrong one and read the wrong `chat_enabled`.

**Fix:** Filter by `is_active = true` first, fall back to most-recent only if none active. Same predicate everywhere.

### H6 — Recruiter revoke authorization is too loose
`chat-token-revoke` allows **any** `members` row in the tenant to revoke — including a Hiring Manager who shouldn't touch a candidate's chat link. Restricted-viewer memory says HMs are read-only.

**Fix:** After membership lookup, also require `system_role in ('owner','admin','recruiter')` (matches existing scorecard-side checks). 403 otherwise.

### H7 — Handoff system message direction
`chat-candidate-handoff` inserts the system marker with `direction='in'`. The recruiter UI treats `in` as candidate-bubble styling. System messages should render as a centered pill.

**Fix:** Insert with `direction='note'` (or whatever the recruiter list already filters as "system divider") and `sender_type='system'`. Confirm `MessageList.tsx` renders it as a system row; one-line tweak there if needed.

### H8 — Realtime instead of 5s polling on the candidate page
Polling is fine for MVP but every open tab hits the DB 12×/min forever. Subscribing to `postgres_changes` on `chat_messages` filtered by `thread_id` is one `useEffect` and matches Phase 1's recruiter pattern.

**Fix:** Add a Realtime subscription in `CandidateChat.tsx` scoped to the thread; keep a 30s safety poll as fallback for stale connections. RLS on `chat_messages` already blocks cross-thread reads — verify the candidate path uses the anon publishable key against a SELECT policy that allows the row (or keep polling and skip this if the policy work would creep scope).

## Out of scope (defer)

- Edge-function tests for the candidate endpoints — track in `docs/chat/FOLLOWUPS.md` and write alongside Phase 3 (recruiter→candidate reply path is the natural moment).
- Magic-link resend UX — needs product input.
- Per-thread (vs per-IP) rate buckets — only relevant once we see real abuse.

## Acceptance

- Concurrency test against `chat_bump_rate_limit` shows exactly `max` successes for N>max parallel callers.
- Calling `issueCandidateChatToken` twice in a row without `forceRotate` returns the same `threadId` and does not write a new `chat_access_tokens` row.
- After 2 days, `chat_rate_limits` rows are gone; after 180 days, audit rows are gone.
- A Hiring Manager calling `chat-token-revoke` gets 403; a recruiter still succeeds.
- `chat-token-verify` and the candidate auth helper share the same code path (grep for duplicated DB query).
- Candidate page receives a recruiter-sent message in <1s without polling.

Say **"Go ahead"** to implement, or call out items to drop/reshape.
