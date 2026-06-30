// Phase 3.3 — Recruiter-triggered thread summary.
//
// POST /functions/v1/chat-ai-summarize
//   Auth: caller JWT (recruiter / admin / owner). RLS on chat_threads gates
//   tenant access; we re-check role via has_role just to be defensive.
//   Body: { threadId: string, force?: boolean }
//
//   Returns { summary, cached, generated_at, message_count }.
//   Persists the latest summary into chat_threads.context_summary so the card
//   survives reloads and is reused by the rolling summariser (Step 3.6).

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateText } from "npm:ai@5";
import { z } from "npm:zod@3.23.8";
import {
  CHAT_MODELS,
  CHAT_TOKEN_CAPS,
  chatAiRunIdFromRequest,
  chatAiResponseHeaders,
  getChatAi,
} from "../_shared/chatAiClient.ts";

const SUMMARIZE_SYSTEM = `You are Gio, summarising a recruiter↔candidate chat thread for a recruiter who needs to catch up fast.

Write a tight briefing (max 120 words, plain prose) with these beats in order, only when present:
- Who the candidate is + the role they're discussing (one short sentence).
- Where the conversation stands today (latest topic, sentiment, blockers).
- Concrete asks or commitments from either side (interview times, docs, comp, etc.).
- Suggested next step for the recruiter (one short clause).

Rules:
- Use only facts present in the transcript. Never invent details.
- No headers, no bullet lists, no markdown. Short sentences.
- Refer to the candidate by first name when available.
- If the transcript is too thin (≤ 2 substantive messages), reply exactly: "Not enough conversation yet to summarise."`;

const BodySchema = z.object({
  threadId: z.string().uuid(),
  force: z.boolean().optional(),
});

function jsonResponse(status: number, body: unknown, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...Object.fromEntries(new Headers(extra)) },
  });
}

function userClient(token: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" });

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return jsonResponse(401, { error: "unauthorized" });

  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonResponse(400, { error: "bad_request" }); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return jsonResponse(400, { error: "bad_request" });
  const { threadId, force } = parsed.data;

  const sbUser = userClient(token);
  const { data: userRes, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !userRes?.user) return jsonResponse(401, { error: "unauthorized" });

  // RLS-gated read — if the caller can't see the thread they get null and we 404.
  const { data: thread } = await sbUser
    .from("chat_threads")
    .select("id, tenant_id, status, message_count, context_summary, updated_at")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return jsonResponse(404, { error: "not_found" });

  const sbAdmin = adminClient();

  // ---- Cache check ----------------------------------------------------
  // context_summary shape we persist: { text, generated_at, message_count, model }.
  // Reuse when the message count hasn't materially moved (< 5 new msgs) unless `force`.
  type Cached = { text: string; generated_at: string; message_count: number; model: string };
  const cached = (thread.context_summary ?? null) as Cached | null;
  if (!force && cached?.text && typeof cached.message_count === "number") {
    const delta = (thread.message_count ?? 0) - cached.message_count;
    if (delta < 5) {
      return jsonResponse(200, {
        summary: cached.text,
        cached: true,
        generated_at: cached.generated_at,
        message_count: cached.message_count,
      });
    }
  }

  // ---- Pull recent transcript (excludes redacted + recruiter notes) ---
  const { data: rows } = await sbAdmin
    .from("chat_messages")
    .select("direction, sender_type, body, created_at")
    .eq("thread_id", threadId)
    .is("redacted_at", null)
    .order("created_at", { ascending: false })
    .limit(60);
  const recent = (rows ?? []).reverse().filter((r) => r.direction !== "note" && r.body && r.body.trim());

  if (recent.length === 0) {
    return jsonResponse(200, {
      summary: "Not enough conversation yet to summarise.",
      cached: false,
      generated_at: new Date().toISOString(),
      message_count: thread.message_count ?? 0,
    });
  }

  // Plain transcript prompt — keeps token use predictable.
  const transcript = recent
    .map((r) => {
      const who = r.sender_type === "candidate"
        ? "Candidate"
        : r.sender_type === "ai"
          ? "Gio"
          : r.sender_type === "system"
            ? "System"
            : "Recruiter";
      return `${who}: ${r.body!.trim()}`;
    })
    .join("\n");

  // ---- Token-cap reserve ---------------------------------------------
  const reserve = CHAT_TOKEN_CAPS.summarize;
  const { data: usage } = await sbAdmin.rpc("chat_consume_ai_tokens", {
    p_tenant_id: thread.tenant_id,
    p_tokens: reserve,
  });
  const usageRow = Array.isArray(usage) ? usage[0] : usage;
  if (usageRow && usageRow.allowed === false) {
    return jsonResponse(429, { error: "daily_token_cap_exceeded" });
  }

  const model = CHAT_MODELS.summarize;
  const ai = getChatAi({ initialRunId: chatAiRunIdFromRequest(req) });

  let text = "";
  let used = 0;
  try {
    const result = await generateText({
      model: ai.model(model),
      system: SUMMARIZE_SYSTEM,
      prompt: `Transcript (most recent last):\n\n${transcript}\n\nWrite the briefing now.`,
    });
    text = (result.text ?? "").trim();
    used = result.usage?.totalTokens ?? 0;
  } catch (e) {
    console.error("[chat-ai-summarize] generation failed", e);
    return jsonResponse(502, { error: "ai_failed" });
  }

  // True-up overage
  const delta = Math.max(used - reserve, 0);
  if (delta > 0) {
    await sbAdmin.rpc("chat_consume_ai_tokens", { p_tenant_id: thread.tenant_id, p_tokens: delta });
  }

  if (!text) {
    return jsonResponse(502, { error: "empty_summary" });
  }

  const generated_at = new Date().toISOString();
  const payload: Cached = {
    text,
    generated_at,
    message_count: thread.message_count ?? recent.length,
    model,
  };

  await sbAdmin
    .from("chat_threads")
    .update({ context_summary: payload, updated_at: generated_at })
    .eq("id", threadId);

  await sbAdmin.from("chat_audit_log").insert({
    tenant_id: thread.tenant_id,
    thread_id: threadId,
    actor_id: userRes.user.id,
    actor_type: "recruiter",
    event: "chat_ai_summarize",
    metadata: { tokens: used, model, forced: !!force },
  });

  return new Response(
    JSON.stringify({
      summary: text,
      cached: false,
      generated_at,
      message_count: payload.message_count,
    }),
    {
      status: 200,
      headers: chatAiResponseHeaders(ai, { ...corsHeaders, "Content-Type": "application/json" }),
    },
  );
});
