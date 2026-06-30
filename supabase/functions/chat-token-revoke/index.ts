// Phase 2.7 — Recruiter-initiated revoke of a candidate's chat magic-link.
//
// POST { threadId, reason? } with a recruiter Supabase JWT. Revokes ALL
// active chat_access_tokens for the thread and writes a `chat_token_revoked`
// audit log entry per token. Idempotent: revoking an already-revoked thread
// returns { revokedCount: 0, alreadyRevoked: true }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  threadId: z.string().uuid(),
  reason: z.string().max(200).optional(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "unauthorized" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  // Validate the caller's JWT using the anon client.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "unauthorized" });
  const userId = userData.user.id;

  let raw: unknown;
  try { raw = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: "invalid_body" });
  const { threadId, reason } = parsed.data;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve thread and confirm caller is a member of the same tenant.
  const { data: thread } = await admin
    .from("chat_threads")
    .select("id, tenant_id, candidate_id, job_id")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return json(404, { error: "thread_not_found" });

  const { data: membership } = await admin
    .from("members")
    .select("id")
    .eq("tenant_id", thread.tenant_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return json(403, { error: "forbidden" });

  const { data: activeTokens } = await admin
    .from("chat_access_tokens")
    .select("id, jti_hash")
    .eq("thread_id", threadId)
    .is("revoked_at", null);

  if (!activeTokens || activeTokens.length === 0) {
    return json(200, { ok: true, revokedCount: 0, alreadyRevoked: true });
  }

  const nowIso = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("chat_access_tokens")
    .update({ revoked_at: nowIso })
    .eq("thread_id", threadId)
    .is("revoked_at", null);
  if (updateErr) {
    console.error("[chat-token-revoke] update failed", updateErr);
    return json(500, { error: "update_failed" });
  }

  try {
    await admin.from("chat_audit_log").insert(
      activeTokens.map((t) => ({
        tenant_id: thread.tenant_id,
        thread_id: threadId,
        actor_type: "recruiter",
        actor_id: userId,
        event: "chat_token_revoked",
        metadata: {
          reason: reason ?? "manual",
          jti_hash: t.jti_hash,
          revoked_at: nowIso,
        },
      })),
    );
  } catch (auditErr) {
    console.warn("[chat-token-revoke] audit log skipped", auditErr);
  }

  return json(200, { ok: true, revokedCount: activeTokens.length });
});
