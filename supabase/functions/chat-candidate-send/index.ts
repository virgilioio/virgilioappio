// Phase 2.5 — Candidate-side message send.
//
// POST /functions/v1/chat-candidate-send
// Body: { token: string, body: string }
//
// Inserts an inbound (direction='in', sender_type='candidate') message on
// behalf of the magic-link holder. Refuses sends when the tenant has paused
// chat or the posting has chat disabled. Tight per-IP rate limit to defend
// against spam and runaway clients.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import {
  audit,
  authenticateCandidateRequest,
  bumpRateLimit,
  jsonResponse,
} from "../_shared/chat-candidate-auth.ts";

const AttachmentSchema = z.object({
  path: z.string().min(1).max(400),
  name: z.string().min(1).max(200),
  mime: z.string().min(1).max(120),
  size: z.number().int().positive().max(10 * 1024 * 1024),
  url: z.string().url().optional(),
});

const BodySchema = z.object({
  token: z.string().min(32).max(2048),
  body: z.string().max(4000).optional().default(""),
  attachment: AttachmentSchema.optional(),
}).refine((v) => (v.body?.trim().length ?? 0) > 0 || !!v.attachment, {
  message: "empty_message",
});


const RATE_MAX = 20; // 20 sends / IP / minute
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

  if (ctx.paused) {
    return jsonResponse(423, { error: "chat_paused" });
  }

  const allowed = await bumpRateLimit(
    supabase,
    "candidate_send_ip",
    ip,
    RATE_MAX,
    RATE_WINDOW,
  );
  if (!allowed) {
    return jsonResponse(429, { error: "rate_limited" }, { "Retry-After": String(RATE_WINDOW) });
  }

  const body = parsed.data.body.trim();
  if (!body) return jsonResponse(400, { error: "empty_body" });

  const { data: inserted, error: insertErr } = await supabase
    .from("chat_messages")
    .insert({
      thread_id: ctx.threadId,
      tenant_id: ctx.tenantId,
      direction: "in",
      sender_type: "candidate",
      body,
    })
    .select("id, thread_id, direction, sender_type, body, parts, created_at")
    .single();

  if (insertErr || !inserted) {
    console.error("[chat-candidate-send] insert failed", insertErr);
    return jsonResponse(500, { error: "internal_error" });
  }

  await audit(supabase, {
    tenant_id: ctx.tenantId,
    thread_id: ctx.threadId,
    actor_type: "candidate",
    event: "message_sent",
    metadata: { body_length: body.length, ip },
  });

  // Fire-and-forget Gio AI reply when the thread is still in AI mode.
  if (ctx.mode === "ai") {
    const internal = Deno.env.get("CHAT_TOKEN_SECRET");
    const projectUrl = Deno.env.get("SUPABASE_URL");
    if (internal && projectUrl) {
      // Abort the dispatch attempt after 4s so a hung fetch never lingers
      // past the candidate response. The agent function itself runs on its
      // own invocation, so this only guards the *handoff* of the request.
      const dispatchController = new AbortController();
      const dispatchTimer = setTimeout(() => dispatchController.abort(), 4_000);
      fetch(`${projectUrl}/functions/v1/chat-agent-reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internal,
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
        },
        body: JSON.stringify({ threadId: ctx.threadId }),
        signal: dispatchController.signal,
      })
        .catch(async (e) => {
          console.warn("[chat-candidate-send] agent dispatch failed", e);
          // Best-effort audit so we can detect dispatch outages without
          // grepping logs. Never let auditing throw out of this branch.
          try {
            await audit(supabase, {
              tenant_id: ctx.tenantId,
              thread_id: ctx.threadId,
              actor_type: "system",
              event: "chat_ai_dispatch_failed",
              metadata: { error: String((e as Error)?.message ?? e).slice(0, 200) },
            });
          } catch { /* noop */ }
        })
        .finally(() => clearTimeout(dispatchTimer));
    }
  }

  return jsonResponse(200, { message: inserted });
});
