# Phase 2.3 — `chat-token-verify` edge function

Build the candidate-side token verification endpoint that the public `/c/chat/:token` page (Step 2.4) and the candidate send/fetch endpoints (Step 2.5) will all call before doing anything sensitive.

Note on email: Step 2.2 minted the token + magic-link path but did not wire the actual send. We'll fold the magic-link email into Step 2.4 (when the public page exists and has a real URL to link to), using the existing Resend/Supabase email pipeline. This step (2.3) is server-side verification only — no email work.

## What this function does

`POST /functions/v1/chat-token-verify` with `{ token: string }`:

1. **Zod validation** of the body shape; 400 on malformed input.
2. **Structural parse** of the token (`tenant.candidate.thread.jti.exp.sig`) — any shape mismatch returns the anti-enumeration `404 { error: "not_found" }`.
3. **HMAC-SHA256 signature check** against `CHAT_TOKEN_SECRET` using constant-time comparison. Mismatch → `404 not_found`.
4. **Expiry check** against `exp` epoch → `404 not_found` (not 401, to avoid leaking "token was real but expired").
5. **DB lookup** of `chat_access_tokens` by `jti_hash` (sha256 of jti). Must match tenant/candidate/thread, not be revoked, not expired. Any miss → `404 not_found`.
6. **Posting gate**: re-verify `job_postings.chat_enabled = true` for the thread's job. If chat got disabled after issuance → `403 { error: "chat_disabled" }`.
7. **Kill-switch gate**: check `tenants.chat_paused`. If paused → `200` with `{ paused: true, … }` so the candidate page can render a "chat is paused" state instead of a hard error.
8. **Rate limiting** (anti-enumeration + brute force): IP-based bucket using `chat_rate_limits` (already in schema) — 30 verify attempts / IP / 5 min. Over limit → `429`. This is the natural place to finally wire item 7 from the Phase 1 audit, scoped to verification only (send-path rate limit comes in Step 2.5).
9. **Audit log**: `chat_token_used` event on success, `chat_token_verify_failed` on signature/expiry/revoked failures (best-effort, never blocks response).
10. **Success response** (`200`):
    ```json
    {
      "threadId": "...",
      "tenantId": "...",
      "candidateId": "...",
      "jobId": "...",
      "mode": "ai" | "recruiter",
      "paused": false,
      "expiresAt": "ISO",
      "candidate": { "firstName": "...", "displayName": "..." },
      "job": { "title": "...", "companyName": "..." }
    }
    ```
    No PII beyond what the candidate already knows about themselves. No tokens echoed back.

## Files

**New:** `supabase/functions/chat-token-verify/index.ts`
- CORS via `npm:@supabase/supabase-js@2/cors` (per project rule).
- Zod body validation.
- Imports a new shared verifier from `_shared/chat-token.ts`.
- `verify_jwt = false` (candidate-side, no Supabase session).

**Edited:** `supabase/functions/_shared/chat-token.ts`
- Add `verifyCandidateChatToken(rawToken)` that does steps 2–5 above and returns either `{ ok: true, payload }` or `{ ok: false, reason }`. Keeps cryptography in one file, mirrors the minting helper.
- Add small `constantTimeEqual(a, b)` helper.

**New (migration):** light index to keep verify fast
- `create index if not exists idx_chat_access_tokens_jti_hash_active on public.chat_access_tokens (jti_hash) where revoked_at is null;`
- `create index if not exists idx_chat_rate_limits_bucket on public.chat_rate_limits (bucket_key, window_start);` (if not already present)

**Edited:** `supabase/config.toml`
- Register `chat-token-verify` with `verify_jwt = false`.

## Security posture

- **Anti-enumeration:** every "wrong" outcome (bad shape, bad signature, expired, revoked, unknown jti, wrong tenant/candidate) returns the identical `404 { error: "not_found" }` body with the same latency profile (we always do the DB lookup, even on signature failure, before responding — cheap because `jti_hash` is indexed and we early-exit on the actual check).
- **No secret echo:** raw token never logged; `jti_hash` only in audit metadata.
- **Constant-time HMAC compare** via `crypto.subtle` digest comparison.
- **IP rate limit** uses the `x-forwarded-for` first hop; if missing, falls back to a `tenant.candidate` bucket parsed from the token *shape* (still safe — failed-shape tokens hit a global "unknown" bucket).
- **Audit:** verify failures recorded but capped at one row per (ip, minute) to avoid log flooding from scanners.

## Out of scope (intentional)

- No `/c/chat/:token` UI — that's Step 2.4.
- No candidate message send/fetch — that's Step 2.5.
- No magic-link email wiring — folded into Step 2.4 once the page exists.
- Send-path rate limit table wiring — done in Step 2.5 where the send endpoint lives.

## Acceptance

- `curl` with a valid token returns 200 + thread context.
- Tampered signature, expired exp, revoked row, unknown jti, wrong shape, wrong content-type → all return identical `404 not_found`.
- 31st verify in 5 min from same IP → `429`.
- Paused tenant → `200 { paused: true }`.
- Posting `chat_enabled` flipped off after issuance → `403 chat_disabled`.
- Audit log shows `chat_token_used` / `chat_token_verify_failed` events.

Say **"Go ahead"** to implement.