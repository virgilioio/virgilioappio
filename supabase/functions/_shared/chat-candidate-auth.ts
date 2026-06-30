// Phase 2.5 — Shared candidate-token auth helper for chat-candidate-* endpoints.
//
// Verifies a magic-link token (shape, signature, expiry, DB row, not revoked,
// posting still chat_enabled), applies a per-IP rate limit, and returns the
// thread/tenant/candidate context needed by send/fetch handlers.
//
// Identical anti-enumeration posture as chat-token-verify: any auth-shaped
// failure returns a generic 404 { error: "not_found" }.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { verifyCandidateChatToken } from "./chat-token.ts";

export interface CandidateContext {
  threadId: string;
  tenantId: string;
  candidateId: string;
  jobId: string;
  mode: "ai" | "recruiter";
  paused: boolean;
  jtiHash: string;
}

export interface AuthOk {
  ok: true;
  ctx: CandidateContext;
  supabase: SupabaseClient;
  ip: string;
}
export interface AuthErr {
  ok: false;
  response: Response;
}

function jsonResponse(status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

const NOT_FOUND = () => jsonResponse(404, { error: "not_found" });

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function ipFrom(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

/** Bucketed rate limit. Returns true if the request is allowed. */
export async function bumpRateLimit(
  supabase: SupabaseClient,
  scope: string,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const windowStart = new Date(
    Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds * 1000,
  ).toISOString();
  try {
    const { data } = await supabase
      .from("chat_rate_limits")
      .select("id, count")
      .eq("scope", scope)
      .eq("scope_key", key)
      .eq("window_start", windowStart)
      .maybeSingle();
    if (data?.id) {
      if ((data.count ?? 0) >= max) return false;
      await supabase
        .from("chat_rate_limits")
        .update({ count: (data.count ?? 0) + 1 })
        .eq("id", data.id);
    } else {
      await supabase.from("chat_rate_limits").insert({
        scope,
        scope_key: key,
        window_start: windowStart,
        count: 1,
      });
    }
  } catch (e) {
    console.warn("[chat-candidate-auth] rate-limit lookup failed", e);
  }
  return true;
}

export async function audit(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("chat_audit_log").insert(row);
  } catch (e) {
    console.warn("[chat-candidate-auth] audit log skipped", e);
  }
}

/**
 * Verify a candidate magic-link token and return the resolved context.
 * Auth failures collapse to 404 not_found; chat-off → 403 chat_disabled.
 */
export async function authenticateCandidateRequest(
  req: Request,
  token: string,
): Promise<AuthOk | AuthErr> {
  const supabase = adminClient();
  const ip = ipFrom(req);

  // Stateless verify first — short-circuits on bad shape/sig/expiry.
  const verified = await verifyCandidateChatToken(token);
  if (!verified.ok) {
    await audit(supabase, {
      tenant_id: null,
      thread_id: null,
      actor_type: "candidate",
      event: "chat_token_verify_failed",
      metadata: { reason: verified.reason, ip, source: "candidate_api" },
    });
    return { ok: false, response: NOT_FOUND() };
  }

  const { payload, jtiHash } = verified;

  // DB cross-check.
  const { data: tokenRow } = await supabase
    .from("chat_access_tokens")
    .select("id, tenant_id, candidate_id, thread_id, expires_at, revoked_at")
    .eq("jti_hash", jtiHash)
    .maybeSingle();

  if (
    !tokenRow ||
    tokenRow.revoked_at ||
    tokenRow.tenant_id !== payload.tenantId ||
    tokenRow.candidate_id !== payload.candidateId ||
    tokenRow.thread_id !== payload.threadId ||
    new Date(tokenRow.expires_at).getTime() <= Date.now()
  ) {
    await audit(supabase, {
      tenant_id: payload.tenantId,
      thread_id: payload.threadId,
      actor_type: "candidate",
      event: "chat_token_verify_failed",
      metadata: { reason: "db_miss_or_revoked", ip, source: "candidate_api" },
    });
    return { ok: false, response: NOT_FOUND() };
  }

  // Thread + tenant lookup.
  const [threadRes, tenantRes] = await Promise.all([
    supabase
      .from("chat_threads")
      .select("id, tenant_id, candidate_id, job_id, mode, status, deleted_at")
      .eq("id", payload.threadId)
      .maybeSingle(),
    supabase
      .from("tenants")
      .select("id, chat_paused")
      .eq("id", payload.tenantId)
      .maybeSingle(),
  ]);

  const thread = threadRes.data;
  const tenant = tenantRes.data;
  if (!thread || !tenant || thread.deleted_at) return { ok: false, response: NOT_FOUND() };

  // Posting gate.
  const { data: posting } = await supabase
    .from("job_postings")
    .select("id, chat_enabled, chat_mode")
    .eq("job_id", thread.job_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!posting || posting.chat_enabled !== true) {
    return {
      ok: false,
      response: jsonResponse(403, { error: "chat_disabled" }),
    };
  }

  return {
    ok: true,
    supabase,
    ip,
    ctx: {
      threadId: thread.id,
      tenantId: thread.tenant_id,
      candidateId: thread.candidate_id,
      jobId: thread.job_id,
      mode: (thread.mode ?? posting.chat_mode ?? "recruiter") as "ai" | "recruiter",
      paused: tenant.chat_paused === true,
      jtiHash,
    },
  };
}

export { NOT_FOUND, jsonResponse };
