// Scorecard reminder cron worker.
// Iterates stages with reminders enabled, finds interviewers who still owe a
// scorecard for a completed interview, and emails them on the configured
// cadence until they submit. Runs via pg_cron; safe to invoke on demand.
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

type Cadence = ScorecardCadence;
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
    // Only stages that both require a scorecard AND have reminders enabled.
    const { data: stages, error: stageErr } = await supabase
      .from("job_hiring_stages")
      .select("id, job_id, require_scorecard, scorecard_reminders_enabled, scorecard_reminder_cadence, custom_stage_name, job_stages!inner(stage_name)")
      .eq("scorecard_reminders_enabled", true)
      .eq("require_scorecard", true);
    if (stageErr) throw stageErr;

    for (const stage of stages || []) {
      const jhsId = (stage as any).id as string;
      const jobId = (stage as any).job_id as string;
      const cadence = (((stage as any).scorecard_reminder_cadence) || "daily") as Cadence;
      const stageName =
        (stage as any).custom_stage_name ||
        (stage as any).job_stages?.stage_name ||
        "this stage";

      // Job title (once per stage)
      const { data: job } = await supabase
        .from("jobs")
        .select("id, title")
        .eq("id", jobId)
        .maybeSingle();
      const jobTitle = (job as any)?.title || "this role";

      // Only completed interviews (scheduled_end passed, not cancelled)
      const { data: bookings } = await supabase
        .from("scheduled_bookings")
        .select("id, interviewer_id, job_candidate_association_id, candidate_id, scheduled_end")
        .eq("job_hiring_stage_id", jhsId)
        .not("status", "eq", "cancelled")
        .lte("scheduled_end", new Date().toISOString());

      // Aggregate per (assocId) so we compute totals once and dedupe interviewers.
      const byAssoc = new Map<string, {
        expected: Set<string>;
        latestInterviewedAt: string | null;
      }>();
      for (const booking of bookings || []) {
        const assocId = (booking as any).job_candidate_association_id as string | null;
        if (!assocId) continue;
        const entry = byAssoc.get(assocId) || { expected: new Set<string>(), latestInterviewedAt: null };
        if ((booking as any).interviewer_id) entry.expected.add((booking as any).interviewer_id);
        const end = (booking as any).scheduled_end as string | null;
        if (end && (!entry.latestInterviewedAt || end > entry.latestInterviewedAt)) {
          entry.latestInterviewedAt = end;
        }
        byAssoc.set(assocId, entry);
        // Attendees
        const { data: attendees } = await supabase
          .from("scheduled_booking_attendees")
          .select("user_id")
          .eq("booking_id", (booking as any).id);
        for (const a of attendees || []) if ((a as any).user_id) entry.expected.add((a as any).user_id);
      }

      for (const [assocId, entry] of byAssoc.entries()) {
        if (entry.expected.size === 0) continue;

        // Stop condition: candidate must still be at this stage.
        const { data: assoc } = await supabase
          .from("job_candidate_associations")
          .select("id, candidate_id, current_stage_id, candidates!inner(first_name, last_name, candidate_name)")
          .eq("id", assocId)
          .maybeSingle();
        if (!assoc || (assoc as any).current_stage_id !== jhsId) continue;

        const candidate = (assoc as any).candidates;
        const candidateFullName =
          candidate?.candidate_name ||
          [candidate?.first_name, candidate?.last_name].filter(Boolean).join(" ") ||
          "the candidate";
        const candidateFirstName =
          candidate?.first_name ||
          (candidate?.candidate_name ? String(candidate.candidate_name).split(" ")[0] : "there");

        // Who already submitted?
        const { data: submittedRows } = await supabase
          .from("job_stage_scorecards")
          .select("created_by, is_ai_draft, rating")
          .eq("stage_instance_id", jhsId)
          .eq("association_id", assocId);
        const submittedIds = new Set(
          (submittedRows || [])
            .filter((s: any) => !s.is_ai_draft && !!s.rating)
            .map((s: any) => s.created_by),
        );
        const submittedCount = submittedIds.size;
        const totalCount = entry.expected.size;

        const owing = [...entry.expected].filter((uid) => !submittedIds.has(uid));
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

          const scorecardUrl = `${appUrl}/jobs/${jobId}?openCandidate=${(assoc as any).candidate_id}&tab=scorecards`;
          const { subject, html, text } = renderScorecardReminderEmail({
            interviewer_first_name: (profile as any)?.first_name || "there",
            candidate_first_name: candidateFirstName,
            candidate_full_name: candidateFullName,
            candidate_initials: initialsFor(candidateFullName),
            candidate_color: colorForName(candidateFullName),
            job_title: jobTitle,
            stage_name: stageName,
            interviewed_when: formatInterviewedWhen(entry.latestInterviewedAt),
            submitted_count: submittedCount,
            total_count: totalCount,
            cadence,
            scorecard_url: scorecardUrl,
          });

          try {
            await resend.emails.send({ from: emailFrom, to: [toEmail], subject, html, text });
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
