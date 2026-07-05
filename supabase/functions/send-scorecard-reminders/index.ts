// Scorecard reminder cron worker.
// Iterates stages with reminders enabled, finds interviewers who still owe a
// scorecard for a completed interview, and emails them on the configured
// cadence until they submit. Runs via pg_cron; safe to invoke on demand.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");
const emailFrom = Deno.env.get("EMAIL_DEFAULT_FROM") || "GoGio <noreply@app.gogio.io>";
const appUrl = Deno.env.get("APP_URL") || "https://app.gogio.io";

type Cadence = "daily" | "every_2_days" | "weekly";
const CADENCE_HOURS: Record<Cadence, number> = {
  daily: 24,
  every_2_days: 48,
  weekly: 24 * 7,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const nowMs = Date.now();
  let queued = 0;
  let sent = 0;
  let skipped = 0;

  try {
    // Only stages with reminders enabled
    const { data: stages, error: stageErr } = await supabase
      .from("job_hiring_stages")
      .select("id, job_id, require_scorecard, scorecard_reminders_enabled, scorecard_reminder_cadence, custom_stage_name, job_stages!inner(stage_name)")
      .eq("scorecard_reminders_enabled", true);
    if (stageErr) throw stageErr;

    for (const stage of stages || []) {
      const jhsId = (stage as any).id as string;
      const jobId = (stage as any).job_id as string;
      const cadence = (((stage as any).scorecard_reminder_cadence) || "daily") as Cadence;
      const stageName =
        (stage as any).custom_stage_name ||
        (stage as any).job_stages?.stage_name ||
        "this stage";

      // Only completed interviews (scheduled_end passed, not cancelled)
      const { data: bookings } = await supabase
        .from("scheduled_bookings")
        .select("id, interviewer_id, job_candidate_association_id, candidate_id, scheduled_end")
        .eq("job_hiring_stage_id", jhsId)
        .not("status", "eq", "cancelled")
        .lte("scheduled_end", new Date().toISOString());

      for (const booking of bookings || []) {
        const assocId = (booking as any).job_candidate_association_id as string | null;
        if (!assocId) continue;

        // Expected interviewer set = booking.interviewer_id + attendees.user_id
        const expected = new Set<string>();
        if ((booking as any).interviewer_id) expected.add((booking as any).interviewer_id);
        const { data: attendees } = await supabase
          .from("scheduled_booking_attendees")
          .select("user_id")
          .eq("booking_id", (booking as any).id);
        for (const a of attendees || []) if (a.user_id) expected.add(a.user_id);
        if (expected.size === 0) continue;

        // Who already submitted?
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

        const owing = [...expected].filter((uid) => !submittedIds.has(uid));
        if (owing.length === 0) continue;

        for (const interviewerId of owing) {
          // Cadence check via tracker row
          const { data: tracker } = await supabase
            .from("scorecard_reminder_sends")
            .select("id, last_sent_at, sent_count")
            .eq("association_id", assocId)
            .eq("job_hiring_stage_id", jhsId)
            .eq("interviewer_user_id", interviewerId)
            .maybeSingle();

          if (tracker) {
            const lastMs = new Date((tracker as any).last_sent_at).getTime();
            const elapsedH = (nowMs - lastMs) / (1000 * 60 * 60);
            if (elapsedH < CADENCE_HOURS[cadence] - 0.5) {
              skipped++;
              continue;
            }
          }

          // Look up interviewer email + candidate name
          const [{ data: profile }, { data: assoc }] = await Promise.all([
            supabase
              .from("profiles")
              .select("user_id, first_name, last_name, email")
              .eq("user_id", interviewerId)
              .maybeSingle(),
            supabase
              .from("job_candidate_associations")
              .select("id, candidate_id, job_id, candidates!inner(first_name, last_name, candidate_name)")
              .eq("id", assocId)
              .maybeSingle(),
          ]);

          const toEmail = (profile as any)?.email;
          if (!toEmail) {
            skipped++;
            continue;
          }
          const firstName = (profile as any)?.first_name || "there";
          const candidate = (assoc as any)?.candidates;
          const candidateName =
            candidate?.candidate_name ||
            [candidate?.first_name, candidate?.last_name].filter(Boolean).join(" ") ||
            "the candidate";

          const scorecardUrl = `${appUrl}/jobs/${jobId}?openCandidate=${(assoc as any)?.candidate_id}&tab=scorecards`;

          const subject = `Reminder: submit your scorecard for ${candidateName}`;
          const html = `
            <p>Hi ${firstName},</p>
            <p>This is a friendly reminder to submit your scorecard for <strong>${candidateName}</strong> at the <strong>${stageName}</strong> stage.</p>
            <p>The hiring team can't move this candidate forward until your feedback is in.</p>
            <p><a href="${scorecardUrl}" style="display:inline-block;background:#6F3FF5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-family:sans-serif">Open scorecard</a></p>
            <p style="color:#8B8F9E;font-size:12px">You'll keep getting this reminder until you submit.</p>
          `;

          try {
            await resend.emails.send({
              from: emailFrom,
              to: [toEmail],
              subject,
              html,
            });
            sent++;
          } catch (e) {
            console.error("[scorecard-reminders] send failed", e);
            skipped++;
            continue;
          }

          // Upsert tracker
          if (tracker) {
            await supabase
              .from("scorecard_reminder_sends")
              .update({
                last_sent_at: new Date().toISOString(),
                sent_count: ((tracker as any).sent_count || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", (tracker as any).id);
          } else {
            await supabase.from("scorecard_reminder_sends").insert({
              association_id: assocId,
              job_hiring_stage_id: jhsId,
              interviewer_user_id: interviewerId,
              last_sent_at: new Date().toISOString(),
              sent_count: 1,
            });
          }
          queued++;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent, queued, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-scorecard-reminders] error", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
