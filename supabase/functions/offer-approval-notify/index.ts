// Offer approvals: the approver's email (2026-10-17). The minute job calls this
// (x-internal-secret) only when there's mail; it claims each approval notice
// (offer_approval_claim_notices_v2: whose turn it is, a reminder a day later,
// or a reminder someone sent with Remind, 2026-10-18),
// emails it unless the approver turned offer emails off, and marks it sent.
// A failure is released and retried, up to five times. The bell was already
// rung by the database when the turn began. ASCII only.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, appBase } from "../_shared/referenceTokens.ts";
import { createEmailTemplate, formatEmailContent } from "../_shared/emailTemplate.ts";

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

interface Notice {
  notice_id: string;
  kind: "turn" | "reminder";
  approver_email: string;
  approver_name: string;
  wants_email: boolean;
  candidate_name: string;
  job_title: string | null;
  job_id: string;
  candidate_id: string;
  requested_by_name: string;
  company: string | null;
  /** Who pressed Remind; null for the turn email and the automatic reminder. */
  nudged_by_name: string | null;
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY missing");
  const address = Deno.env.get("EMAIL_DEFAULT_FROM_ADDRESS") || "noreply@app.gogio.io";
  const { Resend } = await import("npm:resend@2.0.0");
  const res = await new Resend(key).emails.send({ from: `Gio <${address}>`, to: [to], subject: subject.slice(0, 200), html });
  // deno-lint-ignore no-explicit-any
  const err = (res as any)?.error;
  if (err) throw new Error(JSON.stringify(err).slice(0, 400));
}

function message(n: Notice) {
  const job = n.job_title ? ` (${n.job_title})` : "";
  const url = `${appBase()}/jobs/${n.job_id}?candidate=${n.candidate_id}&tab=offer`;
  if (n.kind === "reminder" && n.nudged_by_name) {
    return {
      subject: `${n.nudged_by_name} sent a reminder: the offer for ${n.candidate_name} is waiting for your approval`,
      html: createEmailTemplate({
        recipientName: n.approver_name,
        preheaderText: `${n.nudged_by_name} is waiting on your approval of the offer for ${n.candidate_name}.`,
        title: "A reminder to approve an offer",
        content: formatEmailContent([
          `${esc(n.nudged_by_name)} sent you a reminder: the offer for <strong>${esc(n.candidate_name)}</strong>${esc(job)} is waiting for your approval.`,
          "It can't be sent for signature until you approve or decline it.",
        ]),
        ctaText: "Review the offer",
        ctaUrl: url,
        footerNote: "You're getting this because you're an approver on this job's offer approval chain.",
      }),
    };
  }
  if (n.kind === "reminder") {
    return {
      subject: `Reminder: the offer for ${n.candidate_name} is waiting for your approval`,
      html: createEmailTemplate({
        recipientName: n.approver_name,
        preheaderText: `The offer for ${n.candidate_name} is still waiting for you.`,
        title: "An offer is still waiting for your approval",
        content: formatEmailContent([
          `The offer for <strong>${esc(n.candidate_name)}</strong>${esc(job)} has been waiting for your approval for a day.`,
          "It can't be sent for signature until you approve or decline it.",
        ]),
        ctaText: "Review the offer",
        ctaUrl: url,
        footerNote: "You're getting this because you're an approver on this job's offer approval chain.",
      }),
    };
  }
  return {
    subject: `Approve the offer for ${n.candidate_name}${job}`,
    html: createEmailTemplate({
      recipientName: n.approver_name,
      preheaderText: `${n.requested_by_name} sent the offer for ${n.candidate_name} for approval.`,
      title: "An offer needs your approval",
      content: formatEmailContent([
        `${esc(n.requested_by_name)} sent the offer for <strong>${esc(n.candidate_name)}</strong>${esc(job)} for approval. It's your turn to review it.`,
        "Approve it, or decline it with a note. Nothing goes to the candidate until every approver has approved.",
      ]),
      ctaText: "Review the offer",
      ctaUrl: url,
      footerNote: "You're getting this because you're an approver on this job's offer approval chain.",
    }),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected || req.headers.get("x-internal-secret") !== expected) return json(401, { error: "unauthorized" });
  const supabase = adminClient();
  try {
    const { data, error } = await supabase.rpc("offer_approval_claim_notices_v2", { _limit: 50 });
    if (error) throw error;
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const n of (data ?? []) as Notice[]) {
      try {
        if (!n.wants_email || !n.approver_email) {
          skipped++;
        } else {
          const m = message(n);
          await sendEmail(n.approver_email, m.subject, m.html);
          sent++;
        }
        await supabase.rpc("offer_approval_finish_notice", { _id: n.notice_id, _ok: true });
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("offer-approval-notify", n.notice_id, msg);
        await supabase.rpc("offer_approval_finish_notice", { _id: n.notice_id, _ok: false, _error: msg });
      }
    }
    return json(200, { sent, skipped, failed });
  } catch (err) {
    console.error("offer-approval-notify", err instanceof Error ? err.message : JSON.stringify(err));
    return json(500, { error: "server" });
  }
});
