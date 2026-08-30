// Client-facing reference report.
//
// Two actions:
//   mint    — authed. Rotates a signed share token for a request the caller can
//             already read (RLS enforced through a user-scoped client) and
//             stores only its hash.
//   resolve — public. Returns a CLIENT-SAFE payload only: referee identity,
//             relationship, period and non-internal answers. Gio flags, the
//             summary prose, internal questions, hold notes and the candidate's
//             self-assessment are stripped here, server-side, so the exclusion
//             cannot be lost in the UI.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  adminClient,
  ipFrom,
  issueReferenceToken,
  logReferenceActivity,
  rateLimitOk,
  verifyReferenceToken,
} from "../_shared/referenceTokens.ts";
import { loadRequestContext } from "../_shared/referenceContext.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const NOT_FOUND = () => json(404, { error: "not_found" });

const SHARE_DAYS = 30;

/** Questions the client may see: not flagged internal. */
function clientQuestions(snapshot: Record<string, any>) {
  return ((snapshot.questions ?? []) as any[]).filter((q) => !q.internal);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return NOT_FOUND();

  const supabase = adminClient();
  const ip = ipFrom(req);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NOT_FOUND();
  }

  const action = String(body?.action ?? "");

  if (!(await rateLimitOk(supabase, "reference_report_ip", ip, 120, 300))) {
    return json(429, { error: "rate_limited" });
  }

  try {
    /* ------------------------------------------------------------------ MINT */
    if (action === "mint") {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
      );
      const { data: auth } = await userClient.auth.getUser();
      if (!auth?.user) return json(401, { error: "unauthorized" });

      const requestId = String(body?.request_id ?? "");
      if (!requestId) return NOT_FOUND();

      // RLS decides visibility — no service role here.
      const { data: visible } = await userClient
        .from("reference_requests")
        .select("id, tenant_id")
        .eq("id", requestId)
        .maybeSingle();
      if (!visible) return NOT_FOUND();

      const issued = await issueReferenceToken({
        kind: "report",
        tenantId: visible.tenant_id,
        requestId: visible.id,
        subjectId: visible.id,
        expiresInDays: SHARE_DAYS,
      });

      await supabase
        .from("reference_requests")
        .update({
          share_token_hash: issued.tokenHash,
          share_expires_at: issued.expiresAt,
          share_created_by: auth.user.id,
        })
        .eq("id", visible.id);

      await logReferenceActivity(
        supabase,
        visible.id,
        "report_shared",
        "Client report link created",
        auth.user.id,
      );

      return json(200, { url: issued.url, expires_at: issued.expiresAt });
    }

    /* --------------------------------------------------------------- RESOLVE */
    if (action === "resolve") {
      const verified = await verifyReferenceToken(body?.token);
      if (!verified || verified.kind !== "report") return NOT_FOUND();

      const ctx = await loadRequestContext(supabase, verified.requestId);
      if (!ctx) return NOT_FOUND();
      if (ctx.request.tenant_id !== verified.tenantId) return NOT_FOUND();
      if (ctx.request.share_token_hash !== verified.tokenHash) return NOT_FOUND();
      if (ctx.request.cancelled_at || ctx.request.state === "cancelled") return NOT_FOUND();
      if (
        ctx.request.share_expires_at &&
        Date.parse(ctx.request.share_expires_at) <= Date.now()
      ) {
        return NOT_FOUND();
      }

      const questions = clientQuestions(ctx.snapshot);
      const allowed = new Set(questions.map((q: any) => q.id));

      const { data: referees } = await supabase
        .from("reference_referees")
        .select(
          "id, name, relationship, title, company, period, status, submitted_at, answers, on_hold",
        )
        .eq("request_id", ctx.request.id);

      const rows = (referees ?? [])
        .filter((r) => !r.on_hold && (r.status === "submitted" || r.status === "logged"))
        .map((r) => {
          const raw = (r.answers ?? {}) as Record<string, unknown>;
          const answers = questions
            .filter((q: any) => allowed.has(q.id))
            .map((q: any) => ({ id: q.id, label: q.label, type: q.type, value: raw[q.id] ?? null }))
            .filter((a) => a.value !== null && a.value !== "" && a.value !== undefined);
          return {
            id: r.id,
            name: r.name,
            relationship: r.relationship,
            title: r.title,
            company: r.company,
            period: r.period,
            status: r.status,
            submitted_at: r.submitted_at,
            answers,
          };
        });

      return json(200, {
        brand: { agency_name: ctx.brand.name, logo_url: ctx.brand.logoUrl },
        candidate_name: ctx.candidateName,
        job_title: ctx.jobTitle,
        client_name: ctx.clientName,
        referee_count: rows.length,
        required_count: ctx.refereeCount,
        expires_at: ctx.request.share_expires_at ?? null,
        referees: rows,
      });
    }

    return NOT_FOUND();
  } catch (e) {
    console.error("[reference-report]", e);
    return json(500, { error: "server_error" });
  }
});
