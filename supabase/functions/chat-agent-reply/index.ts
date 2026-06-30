// Phase 3.2 — Gio AI reply (candidate-facing).
//
// POST /functions/v1/chat-agent-reply
//   Internal-only: requires header `x-internal-secret: $CHAT_TOKEN_SECRET`.
//   Body: { threadId: string }
//
// Pulls recent thread context, runs the Gio agent loop (OpenAI via the chat
// AI isolation layer), with three tools:
//   • request_human_handoff   → flips thread to awaiting_human
//   • schedule_interview_link → returns the candidate's booking-link URL
//   • get_job_details         → returns sanitized job posting summary
//
// Hardening:
//   • Per-thread soft lock (DB lease) prevents double-firing.
//   • Per-tenant daily token cap (RPC counter); cap exceeded → fail-soft handoff.
//   • Fail-soft handoff on ANY thrown error so the candidate is never stranded.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateText, stepCountIs, tool } from "npm:ai@4";
import { z } from "npm:zod@3.23.8";
import {
  CHAT_MODELS,
  CHAT_TOKEN_CAPS,
  chatAiRunIdFromRequest,
  chatAiResponseHeaders,
  getChatAi,
  supportsFastMode,
} from "../_shared/chatAiClient.ts";

const SYSTEM_PROMPT = `You are Gio, a warm, concise recruiting assistant chatting on behalf of the hiring team with a candidate.

Ground rules:
- Be friendly and human. Never claim to be a real recruiter.
- Only answer with facts you have from the conversation, the candidate's own messages, or the get_job_details tool. If you don't know, say so and offer to loop in a human.
- Keep replies short (1–3 sentences). Plain prose, no headers, no markdown lists unless the candidate asked for steps.
- When the candidate asks to talk to a person, expresses frustration, asks anything sensitive (compensation negotiation, legal, accommodation), or asks something you can't verify, call request_human_handoff.
- When the candidate is ready to schedule or asks about times/availability, call schedule_interview_link.
- Use get_job_details before answering specific questions about the role.
- Never invent compensation, start dates, benefits, or interview outcomes.`;

function jsonResponse(status: number, body: unknown, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...Object.fromEntries(new Headers(extra)) },
  });
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const BodySchema = z.object({ threadId: z.string().uuid() });

type RollingSummary = {
  text?: string;
  generated_at?: string;
  message_count?: number;
  model?: string;
} | null;

type ThreadCtx = {
  threadId: string;
  tenantId: string;
  candidateId: string;
  jobId: string;
  mode: string;
  status: string;
  messageCount: number;
  contextSummary: RollingSummary;
};

async function loadThread(sb: ReturnType<typeof adminClient>, id: string): Promise<ThreadCtx | null> {
  const { data } = await sb
    .from("chat_threads")
    .select("id, tenant_id, candidate_id, job_id, mode, status, deleted_at, message_count, context_summary")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.deleted_at) return null;
  return {
    threadId: data.id,
    tenantId: data.tenant_id,
    candidateId: data.candidate_id,
    jobId: data.job_id,
    mode: data.mode,
    status: data.status,
    messageCount: Number(data.message_count ?? 0),
    contextSummary: (data.context_summary ?? null) as RollingSummary,
  };
}

async function loadRecentMessages(sb: ReturnType<typeof adminClient>, threadId: string, limit = 20) {
  const { data } = await sb
    .from("chat_messages")
    .select("direction, sender_type, body, created_at")
    .eq("thread_id", threadId)
    .is("redacted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []).reverse();
  // Drop recruiter-only notes; the candidate never saw them.
  return rows.filter((r) => r.direction !== "note");
}

// ----- Rolling context summary (Step 3.6) ---------------------------------
// Refresh `chat_threads.context_summary` every 50 new messages so the agent
// keeps long-running threads grounded without re-sending the entire history.
const ROLLING_SUMMARY_EVERY = 50;

async function maybeRefreshRollingSummary(
  sb: ReturnType<typeof adminClient>,
  ctx: ThreadCtx,
  ai: ReturnType<typeof getChatAi>,
) {
  try {
    // Re-read the latest message_count after the just-inserted assistant turn.
    const { data: fresh } = await sb
      .from("chat_threads")
      .select("message_count, context_summary")
      .eq("id", ctx.threadId)
      .maybeSingle();
    const currentCount = Number(fresh?.message_count ?? ctx.messageCount);
    const prev = (fresh?.context_summary ?? ctx.contextSummary) as RollingSummary;
    const lastAt = Number(prev?.message_count ?? 0);
    if (currentCount - lastAt < ROLLING_SUMMARY_EVERY) return;

    // Pull a wider window for the rolling summary than the agent loop uses.
    const rows = await loadRecentMessages(sb, ctx.threadId, 80);
    if (rows.length === 0) return;
    const transcript = rows
      .filter((r) => r.body && r.body.trim())
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

    const priorBlock = prev?.text ? `Prior summary:\n${prev.text}\n\n` : "";
    const result = await generateText({
      model: ai.model(CHAT_MODELS.summarize),
      system:
        "You maintain a rolling briefing of a recruiter↔candidate chat. Output 4–8 short bullet lines covering: candidate intent, key facts shared (role, location, comp expectations only if stated), open questions, next step. No greetings, no markdown headers, no quotes. Never invent facts.",
      prompt: `${priorBlock}Recent transcript (most recent last):\n${transcript}\n\nWrite the updated rolling summary now.`,
    });
    const text = (result.text ?? "").trim();
    if (!text) return;

    const used = result.usage?.totalTokens ?? 0;
    if (used > 0) {
      await sb.rpc("chat_consume_ai_tokens", { p_tenant_id: ctx.tenantId, p_tokens: used });
    }

    await sb
      .from("chat_threads")
      .update({
        context_summary: {
          text,
          generated_at: new Date().toISOString(),
          message_count: currentCount,
          model: CHAT_MODELS.summarize,
          source: "rolling",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.threadId);

    await sb.from("chat_audit_log").insert({
      tenant_id: ctx.tenantId,
      thread_id: ctx.threadId,
      actor_type: "system",
      event: "chat_ai_rolling_summary_refresh",
      metadata: { tokens: used, model: CHAT_MODELS.summarize, message_count: currentCount },
    });
  } catch (e) {
    // Rolling summary is best-effort; never fail the reply because of it.
    console.error("[chat-agent-reply] rolling summary refresh failed", e);
  }
}

function toModelMessages(rows: { direction: string; sender_type: string; body: string | null }[]) {
  return rows
    .filter((r) => r.body && r.body.trim().length > 0)
    .map((r) => ({
      role: r.sender_type === "candidate" ? ("user" as const) : ("assistant" as const),
      content: r.body!.trim(),
    }));
}

async function postSystemMessage(
  sb: ReturnType<typeof adminClient>,
  ctx: ThreadCtx,
  body: string,
) {
  await sb.from("chat_messages").insert({
    thread_id: ctx.threadId,
    tenant_id: ctx.tenantId,
    direction: "note",
    sender_type: "system",
    body,
  });
}

async function failSoftHandoff(
  sb: ReturnType<typeof adminClient>,
  ctx: ThreadCtx,
  reason: string,
) {
  try {
    await sb
      .from("chat_threads")
      .update({ status: "awaiting_human", mode: "recruiter", updated_at: new Date().toISOString() })
      .eq("id", ctx.threadId);
    await postSystemMessage(sb, ctx, "A teammate will jump in shortly.");
    await sb.from("chat_audit_log").insert({
      tenant_id: ctx.tenantId,
      thread_id: ctx.threadId,
      actor_type: "system",
      event: "chat_ai_fail_soft_handoff",
      metadata: { reason },
    });
  } catch (e) {
    console.error("[chat-agent-reply] fail-soft handoff failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" });

  // Internal-only gate. Re-use CHAT_TOKEN_SECRET so we don't add a new secret.
  const expected = Deno.env.get("CHAT_TOKEN_SECRET");
  const got = req.headers.get("x-internal-secret");
  if (!expected || !got || got !== expected) {
    return jsonResponse(404, { error: "not_found" });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonResponse(400, { error: "bad_request" }); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return jsonResponse(400, { error: "bad_request" });

  const sb = adminClient();
  const ctx = await loadThread(sb, parsed.data.threadId);
  if (!ctx) return jsonResponse(404, { error: "not_found" });

  // Only run if the thread is still in AI mode and active.
  if (ctx.mode !== "ai" || ctx.status !== "active") {
    return jsonResponse(200, { skipped: "not_ai_mode" });
  }

  // ---- Advisory lock (single-flight per thread) ------------------------
  const { data: lockData } = await sb.rpc("chat_try_lock_thread_for_ai", {
    p_thread_id: ctx.threadId,
    p_seconds: 30,
  });
  if (lockData !== true) {
    return jsonResponse(200, { skipped: "locked" });
  }

  const release = async () => {
    try { await sb.rpc("chat_release_thread_ai_lock", { p_thread_id: ctx.threadId }); } catch { /* noop */ }
  };

  try {
    // ---- Token-cap pre-check (cheap reserve of estimated tokens) -------
    const reserve = CHAT_TOKEN_CAPS.reply;
    const { data: usage } = await sb.rpc("chat_consume_ai_tokens", {
      p_tenant_id: ctx.tenantId,
      p_tokens: reserve,
    });
    const row = Array.isArray(usage) ? usage[0] : usage;
    if (row && row.allowed === false) {
      await failSoftHandoff(sb, ctx, "daily_token_cap_exceeded");
      return jsonResponse(200, { handoff: true, reason: "daily_cap" });
    }

    // ---- Tools --------------------------------------------------------
    const tools = {
      request_human_handoff: tool({
        description:
          "Hand the conversation to a human teammate. Call this for sensitive topics, frustration, off-topic questions, or anything you can't verify.",
        inputSchema: z.object({
          reason: z.string().min(1).max(280).describe("Short reason recorded for the recruiter."),
        }),
        execute: async ({ reason }) => {
          await sb
            .from("chat_threads")
            .update({ status: "awaiting_human", mode: "recruiter", updated_at: new Date().toISOString() })
            .eq("id", ctx.threadId);
          await postSystemMessage(sb, ctx, "A teammate will jump in shortly.");
          await sb.from("chat_audit_log").insert({
            tenant_id: ctx.tenantId,
            thread_id: ctx.threadId,
            actor_type: "ai",
            event: "chat_ai_handoff",
            metadata: { reason },
          });
          return { handed_off: true };
        },
      }),

      schedule_interview_link: tool({
        description:
          "Return the candidate's personal booking link so they can pick an interview time.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data: tok } = await sb
            .from("booking_link_tokens")
            .select("token, expires_at")
            .eq("candidate_id", ctx.candidateId)
            .eq("job_id", ctx.jobId)
            .is("used_at", null)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!tok) {
            return { has_link: false, message: "No active booking link — recruiter will send one shortly." };
          }
          const base = Deno.env.get("PUBLIC_APP_URL") ?? "https://app.gogio.io";
          return { has_link: true, url: `${base}/book/${tok.token}` };
        },
      }),

      get_job_details: tool({
        description:
          "Fetch sanitized facts about the role (title, location, work mode, department, summary). Use before answering specific role questions.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data: job } = await sb
            .from("jobs")
            .select("id, title, location, work_mode, employment_type, department, currency")
            .eq("id", ctx.jobId)
            .maybeSingle();
          const { data: posting } = await sb
            .from("job_postings")
            .select("description, summary, is_active")
            .eq("job_id", ctx.jobId)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!job) return { found: false };
          const summary = (posting?.summary || posting?.description || "").slice(0, 1200);
          return {
            found: true,
            title: job.title,
            location: job.location,
            work_mode: job.work_mode,
            employment_type: job.employment_type,
            department: job.department,
            summary,
          };
        },
      }),
    };

    // ---- Build messages + run agent loop ------------------------------
    const recent = await loadRecentMessages(sb, ctx.threadId);
    const messages = toModelMessages(recent);
    if (messages.length === 0) {
      // Nothing to reply to — bail quietly.
      return jsonResponse(200, { skipped: "no_messages" });
    }

    const model = CHAT_MODELS.reply;
    const ai = getChatAi({ initialRunId: chatAiRunIdFromRequest(req) });

    // Inject the rolling context summary (if any) as a prefix to the system
    // prompt so the model stays grounded on long-running threads without
    // resending the full history.
    const rollingText = ctx.contextSummary?.text?.trim();
    const systemPrompt = rollingText
      ? `${SYSTEM_PROMPT}\n\nRolling context summary of the conversation so far (use as background; do not quote verbatim):\n${rollingText}`
      : SYSTEM_PROMPT;

    const result = await generateText({
      model: ai.model(model),
      system: systemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(50),
      ...(supportsFastMode(model)
        ? { providerOptions: { lovable: { service_tier: "priority" } } }
        : {}),
    });

    // True-up token usage (reserve was conservative; add overage if any).
    const used = result.usage?.totalTokens ?? 0;
    const delta = Math.max(used - reserve, 0);
    if (delta > 0) {
      await sb.rpc("chat_consume_ai_tokens", { p_tenant_id: ctx.tenantId, p_tokens: delta });
    }

    // If the model already triggered a handoff tool, the system message is
    // posted by the tool. Only emit a fresh assistant message when there's
    // text *and* the thread is still in AI mode.
    const { data: latestThread } = await sb
      .from("chat_threads")
      .select("status, mode")
      .eq("id", ctx.threadId)
      .maybeSingle();

    const stillAi = latestThread?.mode === "ai" && latestThread?.status === "active";
    const text = (result.text ?? "").trim();

    if (stillAi && text) {
      const { error: insertErr } = await sb.from("chat_messages").insert({
        thread_id: ctx.threadId,
        tenant_id: ctx.tenantId,
        direction: "out",
        sender_type: "ai",
        body: text,
      });
      if (insertErr) {
        console.error("[chat-agent-reply] assistant insert failed", insertErr);
        await failSoftHandoff(sb, ctx, "assistant_insert_failed");
      }
    } else if (stillAi && !text) {
      // Model returned nothing usable → fail-soft.
      await failSoftHandoff(sb, ctx, "empty_reply");
    }

    // ---- Rolling context summary refresh (every 50 messages) -----------
    if (stillAi && text) {
      await maybeRefreshRollingSummary(sb, ctx, ai);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        handed_off: !stillAi,
        tokens: used,
        steps: result.steps?.length ?? 0,
      }),
      {
        status: 200,
        headers: chatAiResponseHeaders(ai, { ...corsHeaders, "Content-Type": "application/json" }),
      },
    );
  } catch (e) {
    console.error("[chat-agent-reply] generation failed", e);
    await failSoftHandoff(sb, ctx, `exception:${(e as Error).message?.slice(0, 200) ?? "unknown"}`);
    return jsonResponse(200, { handoff: true, reason: "exception" });
  } finally {
    await release();
  }
});
