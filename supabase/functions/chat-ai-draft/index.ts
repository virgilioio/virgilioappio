// Phase 3.4 — Recruiter "Draft with Gio".
//
// POST /functions/v1/chat-ai-draft
//   Auth: caller JWT (recruiter / admin / owner). RLS-gated thread read.
//   Body: { threadId: string, instruction?: string, tone?: 'friendly'|'direct'|'enthusiastic'|'apologetic' }
//   Returns { draft, tokens }.
//
//  • Pulls recent transcript (excluding internal notes — recruiter sees them
//    in the UI but we keep AI input scoped to candidate-visible content).
//  • Composes a recruiter-voice reply the recruiter can edit before sending.
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
  supportsFastMode,
} from "../_shared/chatAiClient.ts";

const SYSTEM = `You are Gio drafting a reply *for the recruiter to send to the candidate*. You are not the recruiter — you only suggest words they will edit.

Rules:
- Voice: warm, professional, concise. Sound like a senior recruiter, not a chatbot.
- 1–4 short sentences. Plain prose. No greetings like "Hi {name}" unless the recruiter explicitly asked for one. No sign-off.
- Address the candidate's most recent message and any pending question.
- Only use facts present in the transcript or in the recruiter's instruction. Never invent dates, comp, benefits, interview outcomes, or company details.
- If you don't have enough info to draft something honest, return exactly: "Not enough context to draft this — give me a quick instruction."
- Output plain text only. No markdown, no headers, no labels like "Draft:".`;

const TONE_HINTS: Record<string, string> = {
  friendly: "Tone: friendly and personable.",
  direct: "Tone: direct and efficient — get to the point.",
  enthusiastic: "Tone: warm and enthusiastic about the role.",
  apologetic: "Tone: apologetic and accountable about the delay or issue.",
};

const BodySchema = z.object({
  threadId: z.string().uuid(),
  instruction: z.string().trim().max(500).optional(),
  tone: z.enum(["friendly", "direct", "enthusiastic", "apologetic"]).optional(),
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
  const { threadId, instruction, tone } = parsed.data;

  const sbUser = userClient(token);
  const { data: userRes, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !userRes?.user) return jsonResponse(401, { error: "unauthorized" });

  // RLS-gated thread read.
  const { data: thread } = await sbUser
    .from("chat_threads")
    .select("id, tenant_id, candidate_id, job_id, status, mode, context_summary")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return jsonResponse(404, { error: "not_found" });

  const sbAdmin = adminClient();

  // ---- Pull recent transcript (candidate-visible only) ---------------
  const { data: rows } = await sbAdmin
    .from("chat_messages")
    .select("direction, sender_type, body, created_at")
    .eq("thread_id", threadId)
    .is("redacted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  const recent = (rows ?? [])
    .reverse()
    .filter((r) => r.direction !== "note" && r.body && r.body.trim());

  // ---- Pull candidate + job context for grounding --------------------
  const [{ data: candidate }, { data: job }] = await Promise.all([
    sbAdmin
      .from("candidates")
      .select("first_name, last_name")
      .eq("id", thread.candidate_id)
      .maybeSingle(),
    sbAdmin
      .from("jobs")
      .select("title, location, work_mode, employment_type, department")
      .eq("id", thread.job_id)
      .maybeSingle(),
  ]);

  // ---- Token-cap reserve ---------------------------------------------
  const reserve = CHAT_TOKEN_CAPS.draft;
  const { data: usage } = await sbAdmin.rpc("chat_consume_ai_tokens", {
    p_tenant_id: thread.tenant_id,
    p_tokens: reserve,
  });
  const usageRow = Array.isArray(usage) ? usage[0] : usage;
  if (usageRow && usageRow.allowed === false) {
    return jsonResponse(429, { error: "daily_token_cap_exceeded" });
  }

  // ---- Compose prompt ------------------------------------------------
  const firstName = candidate?.first_name?.trim() || "the candidate";
  const ctxLines: string[] = [];
  ctxLines.push(`Candidate first name: ${firstName}`);
  if (job?.title) ctxLines.push(`Role: ${job.title}${job.department ? ` (${job.department})` : ""}`);
  if (job?.location) ctxLines.push(`Location: ${job.location}`);
  if (job?.work_mode) ctxLines.push(`Work mode: ${job.work_mode}`);
  if (job?.employment_type) ctxLines.push(`Employment type: ${job.employment_type}`);

  const summary = (thread.context_summary as { text?: string } | null)?.text?.trim();
  if (summary) ctxLines.push(`\nPrior summary:\n${summary}`);

  const transcript = recent.length
    ? recent
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
        .join("\n")
    : "(no messages yet)";

  const userPrompt = [
    `Context:\n${ctxLines.join("\n")}`,
    `\nTranscript (most recent last):\n${transcript}`,
    tone ? `\n${TONE_HINTS[tone] ?? ""}` : "",
    instruction
      ? `\nRecruiter instruction: ${instruction}`
      : `\nRecruiter instruction: Draft the next reply.`,
    `\nWrite the draft reply now.`,
  ]
    .filter(Boolean)
    .join("\n");

  const model = CHAT_MODELS.draft;
  const ai = getChatAi({ initialRunId: chatAiRunIdFromRequest(req) });

  let text = "";
  let used = 0;
  try {
    const result = await generateText({
      model: ai.model(model),
      system: SYSTEM,
      prompt: userPrompt,
      ...(supportsFastMode(model)
        ? { providerOptions: { lovable: { service_tier: "priority" } } }
        : {}),
    });
    text = (result.text ?? "").trim();
    used = result.usage?.totalTokens ?? 0;
  } catch (e) {
    console.error("[chat-ai-draft] generation failed", e);
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

  if (!text) return jsonResponse(502, { error: "empty_draft" });

  await sbAdmin.from("chat_audit_log").insert({
    tenant_id: thread.tenant_id,
    thread_id: threadId,
    actor_id: userRes.user.id,
    actor_type: "recruiter",
    event: "chat_ai_draft",
    metadata: { tokens: used, model, tone: tone ?? null, has_instruction: !!instruction },
  });

  return new Response(
    JSON.stringify({ draft: text, tokens: used }),
    {
      status: 200,
      headers: chatAiResponseHeaders(ai, { ...corsHeaders, "Content-Type": "application/json" }),
    },
  );
});
