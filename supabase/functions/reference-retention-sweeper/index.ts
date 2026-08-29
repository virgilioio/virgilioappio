// Cron: reference retention + cancellation hygiene.
//
// 1. Purges referee PII + answers once the request's retention window ends.
// 2. Purges declined referees 30 days after they declined.
// 3. Discards drafts and revokes tokens for cancelled requests.
// 4. Marks expired candidate links as `expired`.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, logReferenceActivity } from "../_shared/referenceTokens.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PURGED = {
  email: null,
  phone: null,
  token_hash: null,
  draft_answers: {},
  answers: {},
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected || req.headers.get("x-internal-secret") !== expected) {
    return json(401, { error: "unauthorized" });
  }

  const supabase = adminClient();
  const nowIso = new Date().toISOString();
  let retentionPurged = 0;
  let declinedPurged = 0;
  let cancelledCleaned = 0;
  let expired = 0;

  try {
    // 1 — retention window elapsed
    const { data: retired } = await supabase
      .from("reference_requests")
      .select("id")
      .not("retention_expires_at", "is", null)
      .lt("retention_expires_at", nowIso)
      .limit(200);

    for (const r of retired ?? []) {
      const { data: rows } = await supabase
        .from("reference_referees")
        .update(PURGED)
        .eq("request_id", r.id)
        .not("email", "is", null)
        .select("id");
      if (rows && rows.length > 0) {
        retentionPurged += rows.length;
        await logReferenceActivity(
          supabase,
          r.id,
          "retention_purged",
          `Referee contact details purged (${rows.length})`,
        );
      }
    }

    // 2 — declined referees, 30 days on
    const { data: declined } = await supabase
      .from("reference_referees")
      .update(PURGED)
      .not("pii_purge_at", "is", null)
      .lt("pii_purge_at", nowIso)
      .not("email", "is", null)
      .select("id");
    declinedPurged = declined?.length ?? 0;

    // 3 — cancelled requests: drop drafts, revoke tokens
    const { data: cancelled } = await supabase
      .from("reference_requests")
      .select("id")
      .or("state.eq.cancelled,cancelled_at.not.is.null")
      .limit(200);

    for (const r of cancelled ?? []) {
      const { data: rows } = await supabase
        .from("reference_referees")
        .update({ token_hash: null, draft_answers: {} })
        .eq("request_id", r.id)
        .not("token_hash", "is", null)
        .select("id");
      if (rows && rows.length > 0) cancelledCleaned += rows.length;
      await supabase
        .from("reference_requests")
        .update({ candidate_token_hash: null })
        .eq("id", r.id)
        .not("candidate_token_hash", "is", null);
    }

    // 4 — candidate links past expiry with nothing submitted
    const { data: stale } = await supabase
      .from("reference_requests")
      .update({ state: "expired" })
      .eq("state", "candidate")
      .is("consent_recorded_at", null)
      .lt("candidate_link_expires_at", nowIso)
      .select("id");
    expired = stale?.length ?? 0;

    return json(200, {
      success: true,
      retention_purged: retentionPurged,
      declined_purged: declinedPurged,
      cancelled_cleaned: cancelledCleaned,
      expired,
    });
  } catch (e) {
    console.error("[reference-retention-sweeper]", e);
    return json(500, { error: e instanceof Error ? e.message : "Internal error" });
  }
});
