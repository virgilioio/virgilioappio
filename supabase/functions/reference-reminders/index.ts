// Cron: reference reminders.
//
// Re-sends the SAME two snapshot templates on the snapshot's cadence.
// Stop conditions: submitted, declined, expired, cancelled, state changed,
// on_hold, reminders disabled, or the referee cap reached.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient } from "../_shared/referenceTokens.ts";
import {
  loadRequestContext,
  sendCandidateEmail,
  sendRefereeEmail,
} from "../_shared/referenceContext.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const DAY = 86_400_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const provided = req.headers.get("x-internal-secret");
  if (!expected || provided !== expected) return json(401, { error: "unauthorized" });

  const supabase = adminClient();
  const now = Date.now();
  let candidateReminders = 0;
  let refereeReminders = 0;

  try {
    // ---- Candidate reminders: state still `candidate`, no consent recorded.
    const { data: waiting } = await supabase
      .from("reference_requests")
      .select("id, created_at, candidate_link_expires_at, state, consent_recorded_at, cancelled_at")
      .eq("state", "candidate")
      .is("consent_recorded_at", null)
      .is("cancelled_at", null)
      .limit(200);

    for (const row of waiting ?? []) {
      if (row.candidate_link_expires_at && new Date(row.candidate_link_expires_at).getTime() < now) {
        await supabase.from("reference_requests").update({ state: "expired" }).eq("id", row.id);
        continue;
      }
      const ctx = await loadRequestContext(supabase, row.id);
      if (!ctx) continue;
      const rem = ctx.snapshot.reminders;
      if (!rem?.enabled) continue;

      const { data: sends } = await supabase
        .from("reference_activity")
        .select("created_at, type")
        .eq("request_id", row.id)
        .in("type", ["candidate_email_sent", "candidate_reminder_sent"])
        .order("created_at", { ascending: false });
      const last = sends?.[0]?.created_at ? new Date(sends[0].created_at).getTime() : null;
      if (!last) continue;
      const reminderCount = (sends ?? []).filter((s) => s.type === "candidate_reminder_sent").length;
      const waitDays =
        reminderCount === 0
          ? Number(rem.candidate_first_after_days) || 3
          : Number(rem.candidate_every_days) || 4;
      if (now - last < waitDays * DAY) continue;

      try {
        await sendCandidateEmail(supabase, ctx, { rotate: true, isReminder: true });
        candidateReminders++;
      } catch (e) {
        console.warn("[reference-reminders] candidate send failed", row.id, e);
      }
    }

    // ---- Referee reminders: invited/opened/in_progress, not held.
    const { data: pending } = await supabase
      .from("reference_referees")
      .select("id, name, email, request_id, status, invited_at, link_expires_at, on_hold")
      .in("status", ["invited", "opened", "in_progress"])
      .eq("on_hold", false)
      .limit(300);

    for (const referee of pending ?? []) {
      if (referee.link_expires_at && new Date(referee.link_expires_at).getTime() < now) continue;
      const ctx = await loadRequestContext(supabase, referee.request_id);
      if (!ctx) continue;
      if (ctx.request.cancelled_at || ctx.request.state === "cancelled") continue;
      const rem = ctx.snapshot.reminders;
      if (!rem?.enabled) continue;

      const { data: sends } = await supabase
        .from("reference_activity")
        .select("created_at, type, label")
        .eq("request_id", referee.request_id)
        .in("type", ["referee_email_sent", "referee_reminder_sent"])
        .order("created_at", { ascending: false });
      const mine = (sends ?? []).filter((s) => (s.label ?? "").includes(referee.name));
      const last = mine[0]?.created_at ? new Date(mine[0].created_at).getTime() : null;
      if (!last) continue;
      const reminderCount = mine.filter((s) => s.type === "referee_reminder_sent").length;
      if (reminderCount >= (Number(rem.referee_max) || 3)) continue;
      const waitDays = Number(rem.referee_first_after_days) || 2;
      if (now - last < waitDays * DAY) continue;

      try {
        await sendRefereeEmail(supabase, ctx, referee, { isReminder: true });
        refereeReminders++;
      } catch (e) {
        console.warn("[reference-reminders] referee send failed", referee.id, e);
      }
    }

    return json(200, {
      success: true,
      candidate_reminders: candidateReminders,
      referee_reminders: refereeReminders,
    });
  } catch (e) {
    console.error("[reference-reminders]", e);
    return json(500, { error: e instanceof Error ? e.message : "Internal error" });
  }
});
