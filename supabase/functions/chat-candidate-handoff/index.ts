// Phase 2.6 — Candidate "Talk to a human" handoff.
//
// POST { token } — authenticates the candidate magic-link, flips the thread
// into recruiter mode with status='awaiting_human', writes a system message,
// and audit-logs the handoff. Rate-limited per IP to prevent spam.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import {
  authenticateCandidateRequest,
  audit,
  bumpRateLimit,
  jsonResponse,
} from "../_shared/chat-candidate-auth.ts";

const BodySchema = z.object({ token: z.string().min(10).max(4096) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return jsonResponse(400, { error: "invalid_body" });

  const auth = await authenticateCandidateRequest(req, parsed.data.token);
  if (!auth.ok) return auth.response;
  const { supabase, ctx, ip } = auth;

  // 5 handoff requests per IP per 10 minutes is plenty.
  const allowed = await bumpRateLimit(supabase, "candidate_handoff_ip", ip, 5, 600);
  if (!allowed) return jsonResponse(429, { error: "rate_limited" });

  if (ctx.paused) return jsonResponse(423, { error: "chat_paused" });

  // Idempotent: if already awaiting_human, just acknowledge.
  const { data: thread } = await supabase
    .from("chat_threads")
    .select("id, status, mode")
    .eq("id", ctx.threadId)
    .maybeSingle();

  if (thread?.status === "awaiting_human") {
    return jsonResponse(200, { ok: true, alreadyRequested: true });
  }

  const { error: updateErr } = await supabase
    .from("chat_threads")
    .update({
      status: "awaiting_human",
      mode: "recruiter",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.threadId);

  if (updateErr) {
    console.error("[chat-candidate-handoff] update failed", updateErr);
    return jsonResponse(500, { error: "update_failed" });
  }

  // Insert a system message so the thread shows the request inline.
  await supabase.from("chat_messages").insert({
    tenant_id: ctx.tenantId,
    thread_id: ctx.threadId,
    direction: "in",
    sender_type: "system",
    body: "The candidate requested to talk to a human.",
  });

  await audit(supabase, {
    tenant_id: ctx.tenantId,
    thread_id: ctx.threadId,
    actor_type: "candidate",
    event: "chat_handoff_requested",
    metadata: { ip, jti_hash: ctx.jtiHash },
  });

  return jsonResponse(200, { ok: true });
});
