// Referee-side sends fired from the recruiter's reference-check card:
// remind every contactable referee, resend to one, or release a held referee.
//
// Authed. Held referees are NEVER emailed except through `release_referee`,
// which clears the hold first — nothing here can contact somebody the candidate
// asked us not to contact yet.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient } from "../_shared/referenceTokens.ts";
import { loadRequestContext, sendRefereeEmail } from "../_shared/referenceContext.ts";

type Action =
  | "remind_referees"
  | "resend_referee"
  | "release_referee"
  | "cancel_request"
  | "delete_request";

const ACTIONS: Action[] = [
  "remind_referees",
  "resend_referee",
  "release_referee",
  "cancel_request",
  "delete_request",
];

/** Statuses that still need (or can take) another email. */
const CONTACTABLE = new Set(["pending", "invited", "opened", "in_progress"]);

/** A referee whose answers must survive a cancel. */
const KEEP = new Set(["submitted", "logged"]);


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
    const action = ACTIONS.includes(body?.action) ? (body.action as Action) : null;
    const refereeId = typeof body?.referee_id === "string" ? body.referee_id : null;

    if (!requestId) return json(400, { error: "request_id is required" });
    if (!action) return json(400, { error: "unknown action" });
    const REFEREE_SCOPED = new Set<Action>(["resend_referee", "release_referee"]);
    if (REFEREE_SCOPED.has(action) && !refereeId) {
      return json(400, { error: "referee_id is required" });
    }

    // Authorisation: the caller must be able to read the request under RLS.
    const { data: visible } = await userClient
      .from("reference_requests")
      .select("id")
      .eq("id", requestId)
      .maybeSingle();
    if (!visible) return json(404, { error: "not_found" });

    const supabase = adminClient();

    // ---- Cancel: stop every outbound contact, keep collected answers.
    if (action === "cancel_request") {
      const { data: request } = await supabase
        .from("reference_requests")
        .select("id, state, cancelled_at, candidate_id")
        .eq("id", requestId)
        .maybeSingle();
      if (!request) return json(404, { error: "not_found" });
      if (request.state === "cancelled") return json(400, { error: "Already cancelled" });

      const { data: all } = await supabase
        .from("reference_referees")
        .select("id, status")
        .eq("request_id", requestId);

      // Referees who never submitted lose their link and their unsent draft.
      for (const r of all ?? []) {
        if (KEEP.has(r.status)) continue;
        await supabase
          .from("reference_referees")
          .update({
            status: "cancelled",
            token_hash: null,
            link_expires_at: null,
            draft_answers: {},
          })
          .eq("id", r.id);
      }

      // The candidate's page promises nothing they entered was kept.
      await supabase
        .from("reference_requests")
        .update({
          state: "cancelled",
          cancelled_at: new Date().toISOString(),
          flagged: false,
          candidate_token_hash: null,
          candidate_link_expires_at: null,
          self_assessment: null,
        })
        .eq("id", requestId);

      const actorName = await displayName(supabase, userData.user.id);
      await supabase.from("reference_activity").insert({
        request_id: requestId,
        type: "request_cancelled",
        label: `Cancelled by ${actorName}`,
        actor: userData.user.id,
      });

      // No email to anyone: a live link now explains itself.
      return json(200, { success: true, cancelled: true });
    }

    // ---- Delete: destroy the record and every answer, keep a minimal audit row.
    if (action === "delete_request") {
      const { data: request } = await supabase
        .from("reference_requests")
        .select("id, candidate_id, tenant_id")
        .eq("id", requestId)
        .maybeSingle();
      if (!request) return json(404, { error: "not_found" });

      const { data: all } = await supabase
        .from("reference_referees")
        .select("id, status")
        .eq("request_id", requestId);
      const destroyed = (all ?? []).filter((r) => KEEP.has(r.status)).length;

      // Audit first — no answer content, only the fact of the deletion.
      await supabase.from("audit_logs").insert({
        user_id: userData.user.id,
        action: "reference_request_deleted",
        table_name: "reference_requests",
        record_id: requestId,
        new_values: {
          candidate_id: request.candidate_id,
          tenant_id: request.tenant_id,
          destroyed_references: destroyed,
          deleted_at: new Date().toISOString(),
        },
      });

      await supabase.from("reference_activity").delete().eq("request_id", requestId);
      await supabase.from("reference_referees").delete().eq("request_id", requestId);
      const { error: delErr } = await supabase
        .from("reference_requests")
        .delete()
        .eq("id", requestId);
      if (delErr) return json(422, { error: delErr.message });

      // Live links now fall through to the ordinary expired card — nothing
      // ever reveals that a request was deleted.
      return json(200, { success: true, deleted: true, destroyed });
    }

    const ctx = await loadRequestContext(supabase, requestId);
    if (!ctx) return json(404, { error: "not_found" });
    if (ctx.request.state === "cancelled") {
      return json(400, { error: "This request was cancelled" });
    }


    const { data: referees } = await supabase
      .from("reference_referees")
      .select("id, name, email, status, on_hold")
      .eq("request_id", requestId);

    const all = referees ?? [];
    let targets: typeof all = [];

    if (action === "remind_referees") {
      targets = all.filter((r) => !r.on_hold && CONTACTABLE.has(r.status));
    } else {
      const one = all.find((r) => r.id === refereeId);
      if (!one) return json(404, { error: "not_found" });
      if (action === "release_referee") {
        if (!one.on_hold && one.status !== "on_hold") {
          return json(400, { error: "This referee is not on hold" });
        }
        await supabase
          .from("reference_referees")
          .update({ on_hold: false, status: "pending", hold_note: null })
          .eq("id", one.id);
      } else if (one.on_hold || one.status === "on_hold") {
        return json(400, { error: "This referee is on hold — release them first" });
      }
      targets = [one];
    }

    let sent = 0;
    const failures: string[] = [];
    for (const r of targets) {
      try {
        await sendRefereeEmail(
          supabase,
          ctx,
          { id: r.id, name: r.name, email: r.email },
          { isReminder: action === "remind_referees" },
        );
        sent += 1;
      } catch (e) {
        failures.push(e instanceof Error ? e.message : `Could not email ${r.name}`);
      }
    }

    if (sent === 0 && failures.length > 0) return json(422, { error: failures[0] });

    return json(200, { success: true, sent, failures });
  } catch (e) {
    console.error("[reference-request-actions]", e);
    return json(500, { error: e instanceof Error ? e.message : "Internal error" });
  }
});
