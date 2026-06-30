// Phase 2.3 — Candidate chat token verification endpoint.
//
// Public (no Supabase auth) endpoint called by /c/chat/:token to resolve a
// magic-link token into thread context. Hardened against enumeration:
// every auth-shaped failure returns the SAME 404 { error: "not_found" }.
//
// Thin wrapper around `authenticateCandidateRequest` (see _shared/chat-candidate-auth.ts);
// adds an IP rate limit, then enriches the response with candidate + job display data.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import {
  audit,
  authenticateCandidateRequest,
  bumpRateLimit,
  ipFrom,
  adminClient,
  jsonResponse,
} from "../_shared/chat-candidate-auth.ts";

const BodySchema = z.object({ token: z.string().min(32).max(2048) });

const RATE_WINDOW_SECONDS = 300; // 5 min
const RATE_MAX = 30;

const NOT_FOUND = () => jsonResponse(404, { error: "not_found" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" });

  const supabase = adminClient();
  const ip = ipFrom(req);

  const allowed = await bumpRateLimit(supabase, "token_verify_ip", ip, RATE_MAX, RATE_WINDOW_SECONDS);
  if (!allowed) {
    return jsonResponse(429, { error: "rate_limited" }, { "Retry-After": "300" });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NOT_FOUND(); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NOT_FOUND();

  const auth = await authenticateCandidateRequest(req, parsed.data.token);
  if (!auth.ok) return auth.response;
  const { ctx } = auth;

  // Enrichment: candidate display + job + tenant name (for header rendering).
  const [candidateRes, jobRes, tenantRes, tokenRes] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, candidate_name, email")
      .eq("id", ctx.candidateId)
      .maybeSingle(),
    supabase
      .from("jobs")
      .select("id, title")
      .eq("id", ctx.jobId)
      .maybeSingle(),
    supabase
      .from("tenants")
      .select("id, name")
      .eq("id", ctx.tenantId)
      .maybeSingle(),
    supabase
      .from("chat_access_tokens")
      .select("expires_at")
      .eq("jti_hash", ctx.jtiHash)
      .maybeSingle(),
  ]);

  if (!candidateRes.data || !tenantRes.data) return NOT_FOUND();

  await audit(supabase, {
    tenant_id: ctx.tenantId,
    thread_id: ctx.threadId,
    actor_type: "candidate",
    event: "chat_token_used",
    metadata: { ip, jti_hash: ctx.jtiHash },
  });

  const fullName = (candidateRes.data.candidate_name ?? "").trim();
  const firstName = fullName.split(/\s+/)[0] ?? "";

  return jsonResponse(200, {
    threadId: ctx.threadId,
    tenantId: ctx.tenantId,
    candidateId: ctx.candidateId,
    jobId: ctx.jobId,
    mode: ctx.mode,
    paused: ctx.paused,
    expiresAt: tokenRes.data?.expires_at ?? null,
    candidate: {
      firstName,
      displayName: fullName || candidateRes.data.email || "Candidate",
    },
    job: {
      title: jobRes.data?.title ?? null,
      companyName: tenantRes.data.name ?? null,
    },
  });
});
