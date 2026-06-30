// Phase 3.5 — Suggested replies (recruiter quick-chips).
//
// POST /functions/v1/chat-ai-suggest-replies
//   Auth: caller JWT (recruiter / admin / owner). RLS-gated thread read.
//   Body: { threadId: string }
//   Returns { suggestions: string[], tokens }.
//
//  • Cheap nano model — 3 short next-reply ideas for the recruiter to one-click.
//  • Pulls the last 10 candidate-visible messages. Skipped if no candidate has
//    written anything yet (nothing to suggest a reply to).
//  • Respects the per-tenant daily token cap.

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

const SYSTEM = `You generate three short reply suggestions for a recruiter to send to a candidate in a hiring chat.

Rules:
- Output exactly 3 distinct one-line suggestions, each on its own line, no numbering, no quotes, no markdown.
- Each suggestion: 6–18 words, plain prose, warm + professional recruiter voice.
- Address the candidate's most recent message. Vary intent across the three (e.g. answer, clarify, schedule).
- Never invent dates, comp, benefits, or interview outcomes. If unsure, suggest asking a clarifying question instead.
- No greetings, no sign-offs, no candidate name.`;

const BodySchema = z.object({ threadId: z.string().uuid() });

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

function parseSuggestions(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*\d.)\]]+\s*/, "").replace(/^["'`]|["'`]$/g, "").trim())
    .filter((l) => l.length > 0 && l.length <= 240)
    .slice(0, 3);
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
  const { threadId } = parsed.data;

  const sbUser = userClient(token);
  const { data: userRes, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !userRes?.user) return jsonResponse(401, { error: "unauthorized" });

  const { data: thread } = await sbUser
    .from("chat_threads")
    .select("id, tenant_id, candidate_id, job_id, status")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return jsonResponse(404, { error: "not_found" });

  const sbAdmin = adminClient();

  const { data: rows } = await sbAdmin
    .from("chat_messages")
    .select("direction, sender_type, body, created_at")
    .eq("thread_id", threadId)
    .is("redacted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);
  const recent = (rows ?? [])
    .reverse()
    .filter((r) => r.direction !== "note" && r.body && r.body.trim());

  const hasCandidateMessage = recent.some((r) => r.sender_type === "candidate");
  if (!hasCandidateMessage) {
    return jsonResponse(200, { suggestions: [], tokens: 0, reason: "no_candidate_message" });
  }

  const [{ data: candidate }, { data: job }] = await Promise.all([
    sbAdmin.from("candidates").select("first_name").eq("id", thread.candidate_id).maybeSingle(),
    sbAdmin
      .from("jobs")
      .select("title, location, work_mode")
      .eq("id", thread.job_id)
      .maybeSingle(),
  ]);

  const ctxLines: string[] = [];
  if (candidate?.first_name) ctxLines.push(`Candidate first name: ${candidate.first_name}`);
  if (job?.title) ctxLines.push(`Role: ${job.title}`);
  if (job?.location) ctxLines.push(`Location: ${job.location}`);
  if (job?.work_mode) ctxLines.push(`Work mode: ${job.work_mode}`);

  const transcript = recent
    .map((r) => {
      const who = r.sender_type === "candidate"
        ? "Candidate"
        : r.sender_type === "ai"
          ? "Gio (AI)"
          : r.sender_type === "system"
            ? "System"
            : "Recruiter";
      return `${who}: ${r.body!.trim()}`;
    })
    .join("\n");

  const userPrompt = [
    ctxLines.length ? `Context:\n${ctxLines.join("\n")}` : "",
    `\nTranscript (most recent last):\n${transcript}`,
    `\nReturn 3 short reply suggestions now, one per line.`,
  ].filter(Boolean).join("\n");

  // ---- Cooldown (per recruiter + thread, 10s) ------------------------
  // Stops accidental rapid "Refresh" clicks from burning tokens.
  const sbAdmin2 = sbAdmin;
  const cooldown = await sbAdmin2.rpc("chat_bump_rate_limit", {
    p_scope: "ai_suggest_replies",
    p_scope_key: `${userRes.user.id}:${threadId}`,
    p_window_seconds: 10,
    p_max: 1,
  });
  const cdRow = Array.isArray(cooldown.data) ? cooldown.data[0] : cooldown.data;
  if (cdRow && cdRow.allowed === false) {
    return jsonResponse(429, { error: "cooldown" }, { "Retry-After": "10" });
  }

  // ---- Token-cap reserve ---------------------------------------------
  const reserve = CHAT_TOKEN_CAPS.suggest;
  const { data: usage } = await sbAdmin.rpc("chat_consume_ai_tokens", {
    p_tenant_id: thread.tenant_id,
    p_tokens: reserve,
  });
  const usageRow = Array.isArray(usage) ? usage[0] : usage;
  if (usageRow && usageRow.allowed === false) {
    return jsonResponse(429, { error: "daily_token_cap_exceeded" });
  }

  const model = CHAT_MODELS.suggest;
  const ai = getChatAi({ initialRunId: chatAiRunIdFromRequest(req) });

  let text = "";
  let used = 0;
  try {
    const result = await generateText({
      model: ai.model(model),
      system: SYSTEM,
      prompt: userPrompt,
    });
    text = (result.text ?? "").trim();
    used = result.usage?.totalTokens ?? 0;
  } catch (e) {
    console.error("[chat-ai-suggest-replies] generation failed", e);
    await sbAdmin.rpc("chat_refund_ai_tokens", { p_tenant_id: thread.tenant_id, p_tokens: reserve });
    return jsonResponse(502, { error: "ai_failed" });
  }

  // True-up: charge overage, refund unused reserve.
  const delta = used - reserve;
  if (delta > 0) {
    await sbAdmin.rpc("chat_consume_ai_tokens", { p_tenant_id: thread.tenant_id, p_tokens: delta });
  } else if (delta < 0) {
    await sbAdmin.rpc("chat_refund_ai_tokens", { p_tenant_id: thread.tenant_id, p_tokens: -delta });
  }

  const suggestions = parseSuggestions(text);
  if (suggestions.length === 0) {
    return jsonResponse(200, { suggestions: [], tokens: used, reason: "empty" });
  }

  await sbAdmin.from("chat_audit_log").insert({
    tenant_id: thread.tenant_id,
    thread_id: threadId,
    actor_id: userRes.user.id,
    actor_type: "recruiter",
    event: "chat_ai_suggest_replies",
    metadata: { tokens: used, model, count: suggestions.length },
  });

  return new Response(
    JSON.stringify({ suggestions, tokens: used }),
    {
      status: 200,
      headers: chatAiResponseHeaders(ai, { ...corsHeaders, "Content-Type": "application/json" }),
    },
  );
});
