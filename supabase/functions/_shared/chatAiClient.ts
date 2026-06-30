// Phase 3.1 — Gio chat AI isolation layer.
//
// Single chokepoint every chat-related AI call must go through. Centralising
// the provider lets us:
//   • swap models in one place (today: OpenAI via Lovable AI Gateway),
//   • enforce a default model + safe token caps per call type,
//   • attach a uniform `metadata` envelope for AI Gateway logs/run-id capture,
//   • keep `LOVABLE_API_KEY` out of every individual edge function.
//
// Do NOT import `openai` directly anywhere else in the chat stack. Always
// import from this module — that's the entire point of the isolation layer.
//
// Usage:
//   import { getChatAi, CHAT_MODELS } from "../_shared/chatAiClient.ts";
//   const ai = getChatAi();
//   const result = await generateText({
//     model: ai.model(CHAT_MODELS.reply),
//     system: "...",
//     messages,
//     providerOptions: { lovable: { service_tier: "priority" } },
//   });

import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@1";

// ---------------------------------------------------------------------------
// Model catalog
// ---------------------------------------------------------------------------
//
// We pin the exact `vendor/model` ids we use across Phase 3 so callers can't
// drift to ad-hoc strings. All must be on the Lovable AI Gateway allowlist —
// see knowledge://ai-models-chat. Update here when we bump models.
//
// Default family is OpenAI GPT-5 — best instruction-following + tool calling
// for the recruiter handoff loop. Fast-mode (`priority`) is supported on the
// reply/draft paths but NOT on summarisation, where latency doesn't matter.

export const CHAT_MODELS = {
  /** Main candidate-facing reply loop (tools, handoff, fast-mode capable). */
  reply: "openai/gpt-5-mini",
  /** Recruiter "Draft with Gio" popover (fast-mode capable). */
  draft: "openai/gpt-5-mini",
  /** Suggested replies chip row — cheap + fast. */
  suggest: "openai/gpt-5-nano",
  /** Thread summary card + rolling context summariser. */
  summarize: "openai/gpt-5-mini",
} as const;

export type ChatModelKey = keyof typeof CHAT_MODELS;
export type ChatModelId = (typeof CHAT_MODELS)[ChatModelKey];

/** Models in the catalog that support `service_tier: "priority"`. */
export const FAST_MODE_MODELS: ReadonlySet<ChatModelId> = new Set([
  "openai/gpt-5-mini",
]);

export function supportsFastMode(model: ChatModelId): boolean {
  return FAST_MODE_MODELS.has(model);
}

// ---------------------------------------------------------------------------
// Token caps (defensive; the tenant-level daily cap lives in Phase 3.2)
// ---------------------------------------------------------------------------

export const CHAT_TOKEN_CAPS: Record<ChatModelKey, number> = {
  reply: 800,
  draft: 600,
  suggest: 200,
  summarize: 1200,
};

// ---------------------------------------------------------------------------
// Provider helper (run-id capturing fetch wrapper)
// ---------------------------------------------------------------------------

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

function createRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      const response = await fetch(input, { ...init, headers });
      const next = response.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim();
      if (!runId && next) runId = next;
      return response;
    },
    getRunId: () => runId,
  };
}

export interface ChatAiClient {
  /** Lovable AI Gateway provider — pass a `CHAT_MODELS.*` id to `model(...)`. */
  model: (id: ChatModelId) => ReturnType<ReturnType<typeof createOpenAICompatible>>;
  /** Last AI Gateway run id captured from response headers (if any). */
  getRunId: () => string | undefined;
}

export interface GetChatAiOptions {
  /** Forward an existing AIG run id (e.g. from an inbound request header). */
  initialRunId?: string;
  /**
   * Only flip on for OpenAI calls that use strict JSON schema (Output.object /
   * generateObject). Gemini calls must leave this off.
   */
  structuredOutputs?: boolean;
}

/**
 * Build the chat-only Lovable AI Gateway client. Call this inside the request
 * handler (per-request closure for run-id capture) — never as a module-level
 * singleton.
 */
export function getChatAi(opts: GetChatAiOptions = {}): ChatAiClient {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    throw new Error(
      "LOVABLE_API_KEY is not configured — required for Gio chat AI.",
    );
  }

  const runIdFetch = createRunIdFetch(opts.initialRunId);

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    supportsStructuredOutputs: opts.structuredOutputs ?? false,
    headers: {
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      "X-Lovable-AIG-Surface": "gio-chat",
    },
    fetch: runIdFetch.fetch,
  });

  return {
    model: (id: ChatModelId) => provider(id),
    getRunId: runIdFetch.getRunId,
  };
}

/** Convenience: extract a Lovable AI Gateway run id from an inbound request. */
export function chatAiRunIdFromRequest(req: Request): string | undefined {
  return req.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || undefined;
}

/**
 * Convenience: forward Lovable AI Gateway response headers back to a caller.
 * Only headers prefixed with `X-Lovable-AIG-` are safe to expose.
 */
export function chatAiResponseHeaders(
  ai: ChatAiClient,
  init?: HeadersInit,
): Headers {
  const headers = new Headers(init);
  const runId = ai.getRunId();
  if (runId) headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
  const expose = new Set(
    (headers.get("Access-Control-Expose-Headers") ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  );
  expose.add(LOVABLE_AIG_RUN_ID_HEADER);
  headers.set("Access-Control-Expose-Headers", Array.from(expose).join(", "));
  return headers;
}
