// Sends email 1 of a reference check: the candidate's "add your references" link.
// Authed — called by the Request references sheet right after the request row
// is created. Mints the candidate token, sends the email, moves the request to
// `candidate` and writes the activity row.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, logReferenceActivity } from "../_shared/referenceTokens.ts";
import { loadRequestContext, sendCandidateEmail } from "../_shared/referenceContext.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json(401, { error: "unauthorized" });

    const body = await req.json().catch(() => ({}));
    const requestId = typeof body?.request_id === "string" ? body.request_id : null;
    if (!requestId) return json(400, { error: "request_id is required" });

    // Authorisation: the caller must be able to read the row under RLS.
    const { data: visible } = await userClient
      .from("reference_requests")
      .select("id")
      .eq("id", requestId)
      .maybeSingle();
    if (!visible) return json(404, { error: "not_found" });

    const supabase = adminClient();
    const ctx = await loadRequestContext(supabase, requestId);
    if (!ctx) return json(404, { error: "not_found" });

    if (ctx.request.state === "cancelled") return json(400, { error: "This request was cancelled" });

    try {
      const { expiresAt, link } = await sendCandidateEmail(supabase, ctx, { rotate: true });
      await supabase
        .from("reference_requests")
        .update({ state: "candidate", candidate_link_expires_at: expiresAt })
        .eq("id", requestId);
      // `link` travels back so the profile card can offer "Copy link" for the
      // link we just sent — the database only ever holds its hash.
      return json(200, { success: true, expires_at: expiresAt, link });
    } catch (sendErr) {
      const message = sendErr instanceof Error ? sendErr.message : "Email send failed";
      await logReferenceActivity(
        supabase,
        requestId,
        "candidate_email_failed",
        `Candidate email not sent — ${message}`,
        userData.user.id,
      );
      return json(422, { error: message });
    }
  } catch (e) {
    console.error("[send-reference-request]", e);
    return json(500, { error: e instanceof Error ? e.message : "Internal error" });
  }
});
