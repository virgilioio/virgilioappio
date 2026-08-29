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

type Action = "remind_referees" | "resend_referee" | "release_referee";

const ACTIONS: Action[] = ["remind_referees", "resend_referee", "release_referee"];

/** Statuses that still need (or can take) another email. */
const CONTACTABLE = new Set(["pending", "invited", "opened", "in_progress"]);

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
    if (action !== "remind_referees" && !refereeId) {
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
