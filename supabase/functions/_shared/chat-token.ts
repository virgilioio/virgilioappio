// Phase 2.2 — Candidate chat magic-link token issuance helper.
//
// Mints a one-time-ish, signed, expiring chat access token for a candidate
// + creates the chat_threads row if it doesn't exist yet. The raw token is
// returned to the caller (to be embedded in a magic link); only the
// SHA-256 hash is persisted in chat_access_tokens.jti_hash.
//
// Defence-in-depth notes:
// - HMAC-SHA256 signature over `tenant.candidate.thread.jti.exp` with CHAT_TOKEN_SECRET.
// - 14-day default expiry; rotated by issuing a new token (old one revoked).
// - Refuses issuance when the posting has chat_enabled=false.
// - Writes a `chat_token_issued` audit log entry.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface IssueChatTokenInput {
  tenantId: string;
  candidateId: string;
  jobId: string;
  associationId?: string | null;
  /** Override the default 14d window. */
  expiresInDays?: number;
  /**
   * When true, revoke any active token and mint a fresh one. Default false:
   * if an active non-expired token already exists, return `{ reused: true }`
   * with no raw token (caller must decide whether to re-send the magic link).
   * Set true only when the caller actually wants to invalidate live sessions.
   */
  forceRotate?: boolean;
}

export interface IssueChatTokenResult {
  /** Raw token to embed in the magic link. Null when `reused` is true. */
  token: string | null;
  threadId: string;
  expiresAt: string;
  /** Absolute /c/chat/:token URL the candidate should open. Null when reused. */
  magicLinkPath: string | null;
  /** True when an existing active token was returned instead of minting a new one. */
  reused: boolean;
}

export interface ParsedChatToken {
  tenantId: string;
  candidateId: string;
  threadId: string;
  jti: string;
  expEpoch: number;
  signature: string;
}

export type VerifyChatTokenResult =
  | { ok: true; payload: ParsedChatToken; jtiHash: string }
  | { ok: false; reason: "shape" | "signature" | "expired" };

const DEFAULT_EXPIRY_DAYS = 14;
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256Hex(key: string, msg: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return b64url(new Uint8Array(sig));
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Mint a candidate chat token and ensure a thread exists.
 * Safe to call multiple times — each call rotates the active token
 * (previous tokens for the same thread are revoked).
 */
export async function issueCandidateChatToken(
  input: IssueChatTokenInput,
): Promise<IssueChatTokenResult> {
  const secret = Deno.env.get("CHAT_TOKEN_SECRET");
  if (!secret) {
    throw new Error("CHAT_TOKEN_SECRET is not configured");
  }

  const supabase = adminClient();

  // 1. Confirm the posting allows chat. If no posting exists for the job
  //    (private/legacy jobs), default to deny — Phase 2 only opens when
  //    the recruiter explicitly enabled chat on the posting.
  const { data: posting, error: postingErr } = await supabase
    .from("job_postings")
    .select("id, chat_enabled, chat_mode")
    .eq("job_id", input.jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (postingErr) {
    console.error("[chat-token] posting lookup failed", postingErr);
    throw new Error("Failed to verify chat configuration");
  }
  if (!posting || posting.chat_enabled !== true) {
    throw new Error("Candidate chat is disabled for this job");
  }

  // 2. Find or create the thread for this candidate + job.
  let threadId: string | null = null;
  const { data: existingThread } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("candidate_id", input.candidateId)
    .eq("job_id", input.jobId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingThread?.id) {
    threadId = existingThread.id;
  } else {
    const { data: newThread, error: threadErr } = await supabase
      .from("chat_threads")
      .insert({
        tenant_id: input.tenantId,
        candidate_id: input.candidateId,
        job_id: input.jobId,
        association_id: input.associationId ?? null,
        // mode is auto-snapshotted by trg_chat_threads_enforce_posting_settings
        status: "open",
        channel: "candidate",
      })
      .select("id")
      .single();

    if (threadErr || !newThread) {
      console.error("[chat-token] thread create failed", threadErr);
      throw new Error("Failed to create chat thread");
    }
    threadId = newThread.id;
  }

  // 3. Reuse-or-rotate gate. By default we never silently kick a candidate
  //    out of an open browser tab — only `forceRotate: true` revokes live tokens.
  const { data: priorTokens } = await supabase
    .from("chat_access_tokens")
    .select("id, jti_hash, expires_at")
    .eq("thread_id", threadId)
    .is("revoked_at", null);

  const nowMs = Date.now();
  const activePriorTokens = (priorTokens ?? []).filter(
    (t) => new Date(t.expires_at).getTime() > nowMs,
  );

  if (!input.forceRotate && activePriorTokens.length > 0) {
    // Return the existing active token's metadata. We deliberately do NOT
    // echo the raw token (we only stored the hash) — callers that need to
    // re-send the magic link should pass forceRotate: true.
    const newest = activePriorTokens.reduce((a, b) =>
      new Date(a.expires_at).getTime() > new Date(b.expires_at).getTime() ? a : b,
    );
    return {
      token: null,
      threadId,
      expiresAt: newest.expires_at,
      magicLinkPath: null,
      reused: true,
    };
  }


  if (priorTokens && priorTokens.length > 0) {
    const nowIso = new Date().toISOString();
    await supabase
      .from("chat_access_tokens")
      .update({ revoked_at: nowIso })
      .eq("thread_id", threadId)
      .is("revoked_at", null);

    try {
      await supabase.from("chat_audit_log").insert(
        priorTokens.map((t) => ({
          tenant_id: input.tenantId,
          thread_id: threadId,
          actor_type: "system",
          event: "chat_token_revoked",
          metadata: {
            reason: "rotated",
            jti_hash: t.jti_hash,
            revoked_at: nowIso,
          },
        })),
      );
    } catch (auditErr) {
      console.warn("[chat-token] revoke audit skipped", auditErr);
    }
  }

  // 4. Mint a fresh token. Payload format: t.c.th.jti.exp (all url-safe).
  const jtiBytes = new Uint8Array(18);
  crypto.getRandomValues(jtiBytes);
  const jti = b64url(jtiBytes);
  const expiresInDays = input.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000);
  const expEpoch = Math.floor(expiresAt.getTime() / 1000);

  const payload = [
    input.tenantId,
    input.candidateId,
    threadId,
    jti,
    String(expEpoch),
  ].join(".");
  const sig = await hmacSha256Hex(secret, payload);
  const token = `${payload}.${sig}`;
  const jtiHash = await sha256Hex(jti);

  // 5. Persist token metadata (hash only — never the raw token / signature).
  const { error: tokenErr } = await supabase.from("chat_access_tokens").insert({
    tenant_id: input.tenantId,
    candidate_id: input.candidateId,
    thread_id: threadId,
    jti_hash: jtiHash,
    expires_at: expiresAt.toISOString(),
  });
  if (tokenErr) {
    console.error("[chat-token] token persist failed", tokenErr);
    throw new Error("Failed to persist chat token");
  }

  // 6. Audit log (best-effort).
  try {
    await supabase.from("chat_audit_log").insert({
      tenant_id: input.tenantId,
      thread_id: threadId,
      actor_type: "system",
      event: "chat_token_issued",
      metadata: {
        candidate_id: input.candidateId,
        job_id: input.jobId,
        expires_at: expiresAt.toISOString(),
        expires_in_days: expiresInDays,
      },
    });
  } catch (auditErr) {
    console.warn("[chat-token] audit log skipped", auditErr);
  }

  return {
    token,
    threadId,
    expiresAt: expiresAt.toISOString(),
    magicLinkPath: `/c/chat/${encodeURIComponent(token)}`,
    reused: false,
  };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Stateless verification (shape + signature + expiry). Does NOT touch the DB.
 * Returns `jtiHash` so callers can immediately look up chat_access_tokens.
 */
export async function verifyCandidateChatToken(
  rawToken: string,
): Promise<VerifyChatTokenResult> {
  const secret = Deno.env.get("CHAT_TOKEN_SECRET");
  if (!secret) throw new Error("CHAT_TOKEN_SECRET is not configured");

  if (typeof rawToken !== "string" || rawToken.length < 32 || rawToken.length > 2048) {
    return { ok: false, reason: "shape" };
  }
  const parts = rawToken.split(".");
  if (parts.length !== 6) return { ok: false, reason: "shape" };
  const [tenantId, candidateId, threadId, jti, expStr, signature] = parts;
  if (!UUID_RE.test(tenantId) || !UUID_RE.test(candidateId) || !UUID_RE.test(threadId)) {
    return { ok: false, reason: "shape" };
  }
  const expEpoch = Number(expStr);
  if (!Number.isFinite(expEpoch) || expEpoch <= 0) return { ok: false, reason: "shape" };
  if (!jti || jti.length < 16 || jti.length > 64) return { ok: false, reason: "shape" };
  if (!signature || signature.length < 16) return { ok: false, reason: "shape" };

  const payload = [tenantId, candidateId, threadId, jti, expStr].join(".");
  const expectedSig = await hmacSha256Hex(secret, payload);
  if (!constantTimeEqual(signature, expectedSig)) {
    return { ok: false, reason: "signature" };
  }
  if (Date.now() / 1000 >= expEpoch) {
    return { ok: false, reason: "expired" };
  }

  const jtiHash = await sha256Hex(jti);
  return {
    ok: true,
    payload: { tenantId, candidateId, threadId, jti, expEpoch, signature },
    jtiHash,
  };
}

