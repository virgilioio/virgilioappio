// Offer approvals: the approver's email (2026-10-17). The minute job calls this
// (x-internal-secret) only when there's mail; it claims each approval notice
// (offer_approval_claim_notices_v2: whose turn it is, a reminder a day later,
// or a reminder someone sent with Remind, 2026-10-18),
// emails it unless the approver turned offer emails off, and marks it sent.
// A failure is released and retried, up to five times. The bell was already
// rung by the database when the turn began. The emails use the Gio ATS design
// (_shared/atsEmail.ts, 2026-10-18). ASCII only.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient } from "../_shared/referenceTokens.ts";
import { message, type Notice } from "./emails.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY missing");
  const address = Deno.env.get("EMAIL_DEFAULT_FROM_ADDRESS") || "noreply@app.gogio.io";
  const { Resend } = await import("npm:resend@2.0.0");
  const res = await new Resend(key).emails.send({ from: `Gio <${address}>`, to: [to], subject: subject.slice(0, 200), html, text });
  // deno-lint-ignore no-explicit-any
  const err = (res as any)?.error;
  if (err) throw new Error(JSON.stringify(err).slice(0, 400));
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
          await sendEmail(n.approver_email, m.subject, m.html, m.text);
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
