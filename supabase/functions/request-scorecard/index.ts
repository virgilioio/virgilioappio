// On-demand scorecard request. Sends the same reminder email used by the
// cron worker and upserts the scorecard_reminder_sends tracker row so the
// UI can render "Requested {time} ago" state.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  renderScorecardReminderEmail,
  initialsFor,
  colorForName,
  formatInterviewedWhen,
  type ScorecardCadence,
} from "../_shared/scorecardReminderEmail.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");
const emailFrom = Deno.env.get("EMAIL_DEFAULT_FROM") || "GoGio <noreply@app.gogio.io>";
const appUrl = Deno.env.get("APP_URL") || "https://app.gogio.io";

interface Body {
  association_id: string;
  job_hiring_stage_id: string;
  interviewer_user_ids?: string[]; // empty/omitted = every still-pending interviewer
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.association_id || !body?.job_hiring_stage_id) {
      return new Response(JSON.stringify({ ok: false, error: "missing ids" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { association_id: assocId, job_hiring_stage_id: jhsId } = body;

    // Stage context
    const { data: stage } = await supabase
      .from("job_hiring_stages")
      .select("id, job_id, custom_stage_name, job_stages!inner(stage_name)")
      .eq("id", jhsId)
      .maybeSingle();
    if (!stage) {
      return new Response(JSON.stringify({ ok: false, error: "stage not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const stageName =
      (stage as any).custom_stage_name ||
      (stage as any).job_stages?.stage_name ||
      "this stage";
    const jobId = (stage as any).job_id;

    // Assoc + candidate
    const { data: assoc } = await supabase
      .from("job_candidate_associations")
      .select("id, candidate_id, candidates!inner(first_name, last_name, candidate_name)")
      .eq("id", assocId)
      .maybeSingle();
    const candidate = (assoc as any)?.candidates;
    const candidateName =
      candidate?.candidate_name ||
      [candidate?.first_name, candidate?.last_name].filter(Boolean).join(" ") ||
      "the candidate";

    // Compute currently pending interviewers for this stage/assoc
    const { data: bookings } = await supabase
      .from("scheduled_bookings")
      .select("id, interviewer_id")
      .eq("job_hiring_stage_id", jhsId)
      .eq("job_candidate_association_id", assocId)
      .not("status", "eq", "cancelled");

    const expected = new Set<string>();
    for (const b of bookings || []) if ((b as any).interviewer_id) expected.add((b as any).interviewer_id);
    const bookingIds = (bookings || []).map((b) => (b as any).id);
    if (bookingIds.length) {
      const { data: attendees } = await supabase
        .from("scheduled_booking_attendees")
        .select("user_id, booking_id")
        .in("booking_id", bookingIds);
      for (const a of attendees || []) if ((a as any).user_id) expected.add((a as any).user_id);
    }
    if (expected.size === 0) {
      const { data: assignments } = await supabase
        .from("stage_interviewer_assignments")
        .select("member_id, assignment_type")
        .eq("job_hiring_stage_id", jhsId);
      const memberIds = (assignments || [])
        .filter((a: any) => a.assignment_type === "required")
        .map((a: any) => a.member_id);
      if (memberIds.length) {
        const { data: members } = await supabase
          .from("members")
          .select("user_id")
          .in("id", memberIds);
        for (const m of members || []) if ((m as any).user_id) expected.add((m as any).user_id);
      }
    }

    const { data: submitted } = await supabase
      .from("job_stage_scorecards")
      .select("created_by, is_ai_draft, rating")
      .eq("stage_instance_id", jhsId)
      .eq("association_id", assocId);
    const submittedIds = new Set(
      (submitted || [])
        .filter((s: any) => !s.is_ai_draft && !!s.rating)
        .map((s: any) => s.created_by),
    );

    const stillPending = [...expected].filter((u) => !submittedIds.has(u));
    const requested = (body.interviewer_user_ids || []).filter(Boolean);
    const targets = requested.length
      ? stillPending.filter((u) => requested.includes(u))
      : stillPending;

    let sent = 0;
    let skipped = 0;

    for (const interviewerId of targets) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, first_name, email")
        .eq("user_id", interviewerId)
        .maybeSingle();
      const toEmail = (profile as any)?.email;
      if (!toEmail) {
        skipped++;
        continue;
      }
      const firstName = (profile as any)?.first_name || "there";
      const scorecardUrl = `${appUrl}/jobs/${jobId}?openCandidate=${(assoc as any)?.candidate_id}&tab=scorecards`;

      const subject = `Scorecard requested: ${candidateName} · ${stageName}`;
      const html = `
        <p>Hi ${firstName},</p>
        <p>The hiring team has asked for your scorecard on <strong>${candidateName}</strong> at the <strong>${stageName}</strong> stage.</p>
        <p>${candidateName} can't move to the next stage until your feedback is in.</p>
        <p><a href="${scorecardUrl}" style="display:inline-block;background:#6F3FF5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-family:sans-serif">Open scorecard</a></p>
      `;

      try {
        await resend.emails.send({ from: emailFrom, to: [toEmail], subject, html });
        sent++;
      } catch (e) {
        console.error("[request-scorecard] send failed", e);
        skipped++;
        continue;
      }

      // Upsert tracker row (unique on association+stage+interviewer)
      const { data: existing } = await supabase
        .from("scorecard_reminder_sends")
        .select("id, sent_count")
        .eq("association_id", assocId)
        .eq("job_hiring_stage_id", jhsId)
        .eq("interviewer_user_id", interviewerId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("scorecard_reminder_sends")
          .update({
            last_sent_at: new Date().toISOString(),
            sent_count: ((existing as any).sent_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", (existing as any).id);
      } else {
        await supabase.from("scorecard_reminder_sends").insert({
          association_id: assocId,
          job_hiring_stage_id: jhsId,
          interviewer_user_id: interviewerId,
          last_sent_at: new Date().toISOString(),
          sent_count: 1,
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent, skipped, targeted: targets.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[request-scorecard] error", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
