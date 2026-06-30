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
}

export interface IssueChatTokenResult {
  /** Raw token to embed in the magic link. Never persisted. */
  token: string;
  threadId: string;
  expiresAt: string;
  /** Absolute /c/chat/:token URL the candidate should open. */
  magicLinkPath: string;
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

  // 3. Revoke any prior active tokens for this thread.
  await supabase
    .from("chat_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .is("revoked_at", null);

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
  };
}
