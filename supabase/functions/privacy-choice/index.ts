// Public (no sign-in): the link in a privacy email. The token is the only
// key; it was sent to the person's own inbox.
//
// POST {token, action: "peek"}   → {purpose, first_name, answered, answer}
// POST {token, action: "remove"} → removes the person for good (+ suppression)
// POST {token, action: "keep"}   → 3-year check only: keep for another 3 years

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient } from "../_shared/referenceTokens.ts";
import { forgetCandidate, sha256Hex } from "../_shared/privacy.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const body = await req.json().catch(() => ({})) as { token?: string; action?: string };
  const token = (body.token ?? "").trim();
  if (!token || token.length > 200) return json(400, { error: "invalid_link" });

  const sb = adminClient();
  const { data: r } = await sb.from("privacy_requests")
    .select("id, candidate_id, purpose, answered_at, answer")
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();
  if (!r) return json(404, { error: "invalid_link" });

  let firstName: string | null = null;
  if (r.candidate_id) {
    const { data: c } = await sb.from("candidates").select("candidate_name").eq("id", r.candidate_id).maybeSingle();
    firstName = ((c as { candidate_name: string | null } | null)?.candidate_name ?? "").trim().split(/\s+/)[0] || null;
  }

  if (body.action === "peek" || !body.action) {
    return json(200, { purpose: r.purpose, first_name: firstName, answered: Boolean(r.answered_at), answer: r.answer });
  }

  if (r.answer === "remove") return json(200, { done: "remove" });

  if (body.action === "remove") {
    if (r.candidate_id) {
      const { data: still } = await sb.from("candidates").select("id").eq("id", r.candidate_id).maybeSingle();
      if (still) await forgetCandidate(sb, r.candidate_id, r.purpose === "retention" ? "asked_at_3_years" : "asked_after_notice");
    }
    await sb.from("privacy_requests").update({ answered_at: new Date().toISOString(), answer: "remove" }).eq("id", r.id);
    return json(200, { done: "remove" });
  }

  if (body.action === "keep" && r.purpose === "retention") {
    if (r.candidate_id) {
      const until = new Date(Date.now() + 3 * 365 * 24 * 3600 * 1000).toISOString();
      await sb.from("candidates").update({ keep_until: until, retention_checked_at: null }).eq("id", r.candidate_id);
    }
    await sb.from("privacy_requests").update({ answered_at: new Date().toISOString(), answer: "keep" }).eq("id", r.id);
    return json(200, { done: "keep" });
  }

  return json(400, { error: "invalid_action" });
});
