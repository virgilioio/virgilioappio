// Phase 2.5 — Candidate-side message fetch.
//
// POST /functions/v1/chat-candidate-fetch
// Body: { token: string, before?: ISO string, limit?: number }
//
// Returns the latest `limit` messages for the candidate's thread, oldest-first
// within the page. Cursor pagination via `before` (exclusive). Internal notes
// (direction='note') and redacted messages are filtered out — the candidate
// must never see recruiter side-conversation.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import {
  authenticateCandidateRequest,
  bumpRateLimit,
  jsonResponse,
} from "../_shared/chat-candidate-auth.ts";

const BodySchema = z.object({
  token: z.string().min(32).max(2048),
  before: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const DEFAULT_LIMIT = 30;
const RATE_MAX = 120; // 120 fetches / IP / minute (polling-friendly)
const RATE_WINDOW = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonResponse(400, { error: "bad_request" }); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return jsonResponse(400, { error: "bad_request" });

  const auth = await authenticateCandidateRequest(req, parsed.data.token);
  if (!auth.ok) return auth.response;

  const { supabase, ctx, ip } = auth;

  const allowed = await bumpRateLimit(
    supabase,
    "candidate_fetch_ip",
    ip,
    RATE_MAX,
    RATE_WINDOW,
  );
  if (!allowed) {
    return jsonResponse(429, { error: "rate_limited" }, { "Retry-After": String(RATE_WINDOW) });
  }

  const limit = parsed.data.limit ?? DEFAULT_LIMIT;
  let q = supabase
    .from("chat_messages")
    .select(
      "id, thread_id, direction, sender_type, body, parts, created_at, redacted_at",
    )
    .eq("thread_id", ctx.threadId)
    .eq("tenant_id", ctx.tenantId)
    .in("direction", ["in", "out"]) // hide internal notes
    .is("redacted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (parsed.data.before) q = q.lt("created_at", parsed.data.before);

  const { data, error } = await q;
  if (error) {
    console.error("[chat-candidate-fetch] query failed", error);
    return jsonResponse(500, { error: "internal_error" });
  }

  const messages = (data ?? []).slice().reverse();

  // Mark recruiter→candidate messages as read by the candidate.
  // Best-effort; do not block the response.
  try {
    await supabase
      .from("chat_messages")
      .update({ read_by_recipient_at: new Date().toISOString() })
      .eq("thread_id", ctx.threadId)
      .eq("direction", "out")
      .is("read_by_recipient_at", null);
    await supabase
      .from("chat_threads")
      .update({ last_candidate_read_at: new Date().toISOString() })
      .eq("id", ctx.threadId);
  } catch (e) {
    console.warn("[chat-candidate-fetch] read marker skipped", e);
  }

  return jsonResponse(200, {
    threadId: ctx.threadId,
    mode: ctx.mode,
    paused: ctx.paused,
    messages,
    nextCursor: messages.length === limit ? messages[0]?.created_at ?? null : null,
  });
});
