// Phase 2.3 — Candidate chat token verification endpoint.
//
// Public (no Supabase auth) endpoint called by /c/chat/:token to resolve a
// magic-link token into thread context. Hardened against enumeration:
// every failure mode returns the SAME 404 { error: "not_found" }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { verifyCandidateChatToken } from "../_shared/chat-token.ts";

const BodySchema = z.object({ token: z.string().min(32).max(2048) });

const NOT_FOUND = () =>
  new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const RATE_WINDOW_SECONDS = 300; // 5 min
const RATE_MAX = 30;

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function ipFrom(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  return first || req.headers.get("cf-connecting-ip") || "unknown";
}

async function checkRateLimit(
  supabase: ReturnType<typeof adminClient>,
  ip: string,
): Promise<boolean> {
  const windowStart = new Date(
    Math.floor(Date.now() / 1000 / RATE_WINDOW_SECONDS) * RATE_WINDOW_SECONDS * 1000,
  ).toISOString();
  // Best-effort upsert + increment. Failure should not block the request.
  try {
    const { data } = await supabase
      .from("chat_rate_limits")
      .select("id, count")
      .eq("scope", "token_verify_ip")
      .eq("scope_key", ip)
      .eq("window_start", windowStart)
      .maybeSingle();

    if (data?.id) {
      if ((data.count ?? 0) >= RATE_MAX) return false;
      await supabase
        .from("chat_rate_limits")
        .update({ count: (data.count ?? 0) + 1 })
        .eq("id", data.id);
    } else {
      await supabase.from("chat_rate_limits").insert({
        scope: "token_verify_ip",
        scope_key: ip,
        window_start: windowStart,
        count: 1,
      });
    }
  } catch (e) {
    console.warn("[chat-token-verify] rate-limit lookup failed", e);
  }
  return true;
}

async function audit(
  supabase: ReturnType<typeof adminClient>,
  row: Record<string, unknown>,
) {
  try {
    await supabase.from("chat_audit_log").insert(row);
  } catch (e) {
    console.warn("[chat-token-verify] audit log skipped", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = adminClient();
  const ip = ipFrom(req);

  // 1. Rate limit (per IP, per 5 min).
  const allowed = await checkRateLimit(supabase, ip);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "300" },
    });
  }

  // 2. Body validation.
  let body: unknown;
  try { body = await req.json(); } catch { return NOT_FOUND(); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NOT_FOUND();

  // 3. Crypto verify (shape + signature + expiry).
  const verified = await verifyCandidateChatToken(parsed.data.token);
  if (!verified.ok) {
    await audit(supabase, {
      tenant_id: null,
      thread_id: null,
      actor_type: "candidate",
      event: "chat_token_verify_failed",
      metadata: { reason: verified.reason, ip },
    });
    return NOT_FOUND();
  }

  const { payload, jtiHash } = verified;

  // 4. DB lookup — must match jti_hash, thread, tenant, candidate; not revoked.
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
      metadata: { reason: "db_miss_or_revoked", ip },
    });
    return NOT_FOUND();
  }

  // 5. Resolve thread + posting + tenant + job + candidate in parallel.
  const [threadRes, tenantRes, candidateRes] = await Promise.all([
    supabase
      .from("chat_threads")
      .select("id, tenant_id, candidate_id, job_id, mode, status")
      .eq("id", payload.threadId)
      .maybeSingle(),
    supabase
      .from("tenants")
      .select("id, name, chat_paused")
      .eq("id", payload.tenantId)
      .maybeSingle(),
    supabase
      .from("candidates")
      .select("id, candidate_name, email")
      .eq("id", payload.candidateId)
      .maybeSingle(),
  ]);

  const thread = threadRes.data;
  const tenant = tenantRes.data;
  const candidate = candidateRes.data;

  if (!thread || !tenant || !candidate) return NOT_FOUND();

  // 6. Posting gate — chat must still be enabled on the latest posting.
  const { data: posting } = await supabase
    .from("job_postings")
    .select("id, chat_enabled, chat_mode")
    .eq("job_id", thread.job_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!posting || posting.chat_enabled !== true) {
    return new Response(JSON.stringify({ error: "chat_disabled" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 7. Job context.
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("id", thread.job_id)
    .maybeSingle();

  // 8. Success audit.
  await audit(supabase, {
    tenant_id: payload.tenantId,
    thread_id: payload.threadId,
    actor_type: "candidate",
    event: "chat_token_used",
    metadata: { ip, jti_hash: jtiHash },
  });

  const fullName = (candidate.candidate_name ?? "").trim();
  const firstName = fullName.split(/\s+/)[0] ?? "";

  return new Response(
    JSON.stringify({
      threadId: thread.id,
      tenantId: thread.tenant_id,
      candidateId: thread.candidate_id,
      jobId: thread.job_id,
      mode: (thread.mode ?? posting.chat_mode ?? "recruiter") as "ai" | "recruiter",
      paused: tenant.chat_paused === true,
      expiresAt: tokenRow.expires_at,
      candidate: {
        firstName,
        displayName: fullName || candidate.email || "Candidate",
      },
      job: {
        title: job?.title ?? null,
        companyName: tenant.name ?? null,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
