// Daily (cron, x-internal-secret): privacy notices and the 3-year check.
//
// 1. Notices: people we collected (Apollo, People Data Labs, LinkedIn,
//    sourcing) get "Your professional details at Virgilio" once, newest
//    first, at most NOTICE_DAILY_CAP a day (the backlog spreads over ~2 weeks).
// 2. Retention: no contact for 3 years → "Should Virgilio keep your
//    details?"; no answer within 30 days → removed for good.
//
// Body: {} (the daily run) · {"dry_run": true} (counts, no emails) ·
// {"test_to": "you@x"} (one notice to that address, tied to no candidate).

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient } from "../_shared/referenceTokens.ts";
import {
  choiceUrl,
  forgetCandidate,
  newToken,
  renderNoticeEmail,
  renderRetentionEmail,
  sendPrivacyEmail,
  sha256Hex,
  VIRGILIO_TENANT_ID,
} from "../_shared/privacy.ts";

const NOTICE_DAILY_CAP = Number(Deno.env.get("PRIVACY_NOTICE_DAILY_CAP") ?? 110);
const RETENTION_DAILY_CAP = 50;
const RETENTION_GRACE_DAYS = 30;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected || req.headers.get("x-internal-secret") !== expected) return json(401, { error: "unauthorized" });

  const sb = adminClient();
  const body = await req.json().catch(() => ({})) as { dry_run?: boolean; test_to?: string };
  const out = { notices_sent: 0, notices_failed: 0, retention_sent: 0, removed_after_no_answer: 0, errors: [] as string[] };

  // A single test notice to an address you own (no candidate attached).
  if (body.test_to) {
    const token = newToken();
    const url = choiceUrl(token);
    await sb.from("privacy_requests").insert({
      tenant_id: VIRGILIO_TENANT_ID, candidate_id: null, purpose: "notice", email: body.test_to,
      token_hash: await sha256Hex(token), sent_at: new Date().toISOString(),
    });
    await sendPrivacyEmail(body.test_to, renderNoticeEmail({ firstName: "Allan", source: "apollo", url }), url);
    return json(200, { test_sent_to: body.test_to, link: url });
  }

  // Notices sent in the last 24h count against today's cap.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: sentToday } = await sb.from("privacy_requests").select("id", { count: "exact", head: true })
    .eq("purpose", "notice").not("candidate_id", "is", null).gte("sent_at", since);
  const room = Math.max(0, NOTICE_DAILY_CAP - (sentToday ?? 0));

  const { data: due, error: dueErr } = await sb.rpc("candidates_due_for_notice", { p_tenant: VIRGILIO_TENANT_ID, p_limit: room });
  if (dueErr) return json(500, { error: dueErr.message });
  const { data: retDue } = await sb.rpc("candidates_due_for_retention", { p_tenant: VIRGILIO_TENANT_ID, p_limit: RETENTION_DAILY_CAP });

  if (body.dry_run) {
    return json(200, { dry_run: true, cap: NOTICE_DAILY_CAP, sent_last_24h: sentToday ?? 0, would_send_notices: due?.length ?? 0, would_send_retention: retDue?.length ?? 0 });
  }

  // 1. Notices.
  for (const c of (due ?? []) as { candidate_id: string; email: string; first_name: string | null; source: string | null }[]) {
    const token = newToken();
    const url = choiceUrl(token);
    try {
      const { data: reqRow, error } = await sb.from("privacy_requests").insert({
        tenant_id: VIRGILIO_TENANT_ID, candidate_id: c.candidate_id, purpose: "notice", email: c.email,
        token_hash: await sha256Hex(token),
      }).select("id").single();
      if (error) throw error;
      await sendPrivacyEmail(c.email, renderNoticeEmail({ firstName: c.first_name, source: c.source, url }), url);
      const now = new Date().toISOString();
      await sb.from("privacy_requests").update({ sent_at: now }).eq("id", reqRow.id);
      await sb.from("candidates").update({ privacy_notice_at: now }).eq("id", c.candidate_id);
      out.notices_sent++;
    } catch (e) {
      out.notices_failed++;
      out.errors.push(String((e as Error).message ?? e).slice(0, 200));
      if (out.notices_failed >= 5) break; // something is wrong with sending; try again tomorrow
    }
  }

  // 2a. The 3-year check.
  for (const c of (retDue ?? []) as { candidate_id: string; email: string; first_name: string | null }[]) {
    const token = newToken();
    const url = choiceUrl(token);
    try {
      await sb.from("privacy_requests").insert({
        tenant_id: VIRGILIO_TENANT_ID, candidate_id: c.candidate_id, purpose: "retention", email: c.email,
        token_hash: await sha256Hex(token), sent_at: new Date().toISOString(),
      });
      await sendPrivacyEmail(c.email, renderRetentionEmail({ firstName: c.first_name, url }), url);
      await sb.from("candidates").update({ retention_checked_at: new Date().toISOString() }).eq("id", c.candidate_id);
      out.retention_sent++;
    } catch (e) {
      out.errors.push(String((e as Error).message ?? e).slice(0, 200));
    }
  }

  // 2b. No answer within 30 days: removed for good.
  const cutoff = new Date(Date.now() - RETENTION_GRACE_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: expired } = await sb.from("privacy_requests").select("id, candidate_id")
    .eq("purpose", "retention").is("answered_at", null).lt("sent_at", cutoff).not("candidate_id", "is", null).limit(100);
  for (const r of (expired ?? []) as { id: string; candidate_id: string }[]) {
    try {
      const { data: cand } = await sb.from("candidates").select("id, keep_until").eq("id", r.candidate_id).maybeSingle();
      if (cand && !(cand as { keep_until: string | null }).keep_until) {
        await forgetCandidate(sb, r.candidate_id, "no_answer_after_3_years");
        out.removed_after_no_answer++;
      }
      await sb.from("privacy_requests").update({ answered_at: new Date().toISOString(), answer: "remove" }).eq("id", r.id);
    } catch (e) {
      out.errors.push(String((e as Error).message ?? e).slice(0, 200));
    }
  }

  return json(200, out);
});
