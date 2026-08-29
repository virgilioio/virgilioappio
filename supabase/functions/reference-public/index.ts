// Single public endpoint for the two token-resolved reference pages.
//
// No JWT. Everything is resolved from an HMAC-signed token; every auth-shaped
// failure returns one identical { error: "not_found" } so tokens can't be
// enumerated, and per-IP rate limits apply to every action.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient,
  ipFrom,
  logReferenceActivity,
  rateLimitOk,
  verifyReferenceToken,
} from "../_shared/referenceTokens.ts";
import { loadRequestContext, sendRefereeEmail } from "../_shared/referenceContext.ts";
import { estimatedMinutes } from "../_shared/referenceEmail.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const NOT_FOUND = () => json(404, { error: "not_found" });

const TERMINAL_REQUEST_STATES = new Set(["cancelled"]);

function visibleQuestions(snapshot: Record<string, any>) {
  return (snapshot.questions ?? []).filter((q: any) => !q.internal);
}

function publicBrand(ctx: any) {
  return {
    agency_name: ctx.brand.name,
    logo_url: ctx.brand.logoUrl,
  };
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
  const token = body?.token;

  if (!(await rateLimitOk(supabase, "reference_public_ip", ip, 120, 300))) {
    return json(429, { error: "rate_limited" });
  }

  const verified = await verifyReferenceToken(token);
  if (!verified) return NOT_FOUND();

  const ctx = await loadRequestContext(supabase, verified.requestId);
  if (!ctx) return NOT_FOUND();
  if (ctx.request.tenant_id !== verified.tenantId) return NOT_FOUND();

  const snapshot = ctx.snapshot;
  const cancelled =
    TERMINAL_REQUEST_STATES.has(ctx.request.state) || !!ctx.request.cancelled_at;

  try {
    /* ---------------------------------------------------------------- CANDIDATE */
    if (verified.kind === "candidate") {
      if (ctx.request.candidate_token_hash !== verified.tokenHash) return NOT_FOUND();

      if (action === "resolve") {
        const { data: existing } = await supabase
          .from("reference_referees")
          .select("name, email, on_hold")
          .eq("request_id", ctx.request.id);

        return json(200, {
          kind: "candidate",
          status: cancelled
            ? "cancelled"
            : ctx.request.consent_recorded_at
              ? "already_submitted"
              : "open",
          brand: publicBrand(ctx),
          candidate_name: ctx.candidateName,
          candidate_first_name: ctx.candidateFirstName,
          job_title: ctx.jobTitle,
          client_name: ctx.clientName,
          recruiter_name: ctx.recruiterName,
          referee_count: ctx.refereeCount,
          max_referees: snapshot.max_referees ?? Math.max(ctx.refereeCount, 3),
          relationship_rules: snapshot.relationship_rules ?? [],
          referee_fields: snapshot.referee_fields ?? [],
          consent_text: snapshot.consent_text ?? "",
          self_assessment_questions: visibleQuestions(snapshot).filter(
            (q: any) => q.ask_candidate_too,
          ),
          expires_at: ctx.request.candidate_link_expires_at,
          submitted_referees: (existing ?? []).map((r) => ({
            name: r.name,
            held: r.on_hold,
          })),
        });
      }

      if (action === "submit_candidate") {
        if (cancelled) return json(409, { error: "cancelled" });
        if (ctx.request.consent_recorded_at) return json(409, { error: "already_submitted" });
        if (!(await rateLimitOk(supabase, "reference_submit_ip", ip, 10, 3600))) {
          return json(429, { error: "rate_limited" });
        }

        const referees = Array.isArray(body?.referees) ? body.referees : [];
        const contactable = referees.filter((r: any) => !r?.on_hold);
        if (referees.length === 0 || contactable.length < ctx.refereeCount) {
          return json(400, { error: "not_enough_referees" });
        }
        if (referees.length > 8) return json(400, { error: "too_many_referees" });
        if (body?.consent !== true) return json(400, { error: "consent_required" });

        const rows = referees.map((r: any) => ({
          request_id: ctx.request.id,
          source: "candidate" as const,
          name: String(r?.name ?? "").slice(0, 160),
          email: r?.email ? String(r.email).slice(0, 255) : null,
          phone: r?.phone ? String(r.phone).slice(0, 60) : null,
          company: r?.company ? String(r.company).slice(0, 160) : null,
          title: r?.title ? String(r.title).slice(0, 160) : null,
          relationship: r?.relationship ? String(r.relationship).slice(0, 120) : null,
          period: r?.period ? String(r.period).slice(0, 120) : null,
          on_hold: r?.on_hold === true,
          hold_note: r?.hold_note ? String(r.hold_note).slice(0, 500) : null,
          status: (r?.on_hold === true ? "on_hold" : "pending") as const,
        }));

        const { data: inserted, error: insErr } = await supabase
          .from("reference_referees")
          .insert(rows)
          .select("id, name, email, on_hold");
        if (insErr) throw insErr;

        const retentionMonths = Number(snapshot.retention_months) || 12;
        await supabase
          .from("reference_requests")
          .update({
            state: "referees",
            consent_recorded_at: new Date().toISOString(),
            self_assessment: body?.self_assessment ?? {},
            retention_expires_at: new Date(
              Date.now() + retentionMonths * 30 * 86_400_000,
            ).toISOString(),
          })
          .eq("id", ctx.request.id);

        await logReferenceActivity(
          supabase,
          ctx.request.id,
          "candidate_submitted",
          `${ctx.candidateName || "Candidate"} submitted ${inserted?.length ?? 0} referees`,
        );

        const emailed: string[] = [];
        const failed: string[] = [];
        for (const r of inserted ?? []) {
          if (r.on_hold) {
            await logReferenceActivity(
              supabase,
              ctx.request.id,
              "referee_held",
              `${r.name} held — not contacted yet`,
            );
            continue;
          }
          try {
            await sendRefereeEmail(supabase, ctx, r);
            emailed.push(r.name);
          } catch (e) {
            failed.push(r.name);
            await logReferenceActivity(
              supabase,
              ctx.request.id,
              "referee_email_failed",
              `Could not email ${r.name} — ${e instanceof Error ? e.message : "send failed"}`,
            );
          }
        }
        if (failed.length > 0) {
          await supabase
            .from("reference_requests")
            .update({ state: "attention" })
            .eq("id", ctx.request.id);
        }

        return json(200, {
          success: true,
          emailed,
          held: (inserted ?? []).filter((r) => r.on_hold).map((r) => r.name),
        });
      }

      return NOT_FOUND();
    }

    /* ------------------------------------------------------------------ REFEREE */
    const { data: referee } = await supabase
      .from("reference_referees")
      .select("*")
      .eq("id", verified.subjectId)
      .eq("request_id", ctx.request.id)
      .maybeSingle();
    if (!referee) return NOT_FOUND();
    if (referee.token_hash !== verified.tokenHash) return NOT_FOUND();
    if (referee.on_hold) return NOT_FOUND();

    if (action === "resolve") {
      if (!referee.opened_at) {
        await supabase
          .from("reference_referees")
          .update({ opened_at: new Date().toISOString(), status: referee.status === "invited" ? "opened" : referee.status })
          .eq("id", referee.id);
        await logReferenceActivity(
          supabase,
          ctx.request.id,
          "referee_opened",
          `${referee.name} opened the questionnaire`,
        );
      }

      return json(200, {
        kind: "referee",
        status: cancelled
          ? "cancelled"
          : referee.status === "submitted"
            ? "submitted"
            : referee.status === "declined"
              ? "declined"
              : "open",
        brand: publicBrand(ctx),
        referee_name: referee.name,
        referee_first_name: (referee.name || "").split(" ")[0] || referee.name,
        candidate_name: ctx.candidateName,
        job_title: ctx.jobTitle,
        client_name: ctx.clientName,
        recruiter_name: ctx.recruiterName,
        questions: visibleQuestions(snapshot),
        estimated_minutes: estimatedMinutes(snapshot.questions ?? []),
        draft_answers: referee.draft_answers ?? {},
        resumed: Object.keys(referee.draft_answers ?? {}).length > 0,
        expires_at: referee.link_expires_at,
      });
    }

    if (cancelled) return json(409, { error: "cancelled" });
    if (referee.status === "submitted") return json(409, { error: "already_submitted" });
    if (referee.status === "declined") return json(409, { error: "declined" });

    if (action === "save_answer" || action === "save_draft") {
      if (!(await rateLimitOk(supabase, "reference_autosave_ip", ip, 300, 3600))) {
        return json(429, { error: "rate_limited" });
      }
      const draft = { ...(referee.draft_answers ?? {}), ...(body?.answers ?? {}) };
      await supabase
        .from("reference_referees")
        .update({
          draft_answers: draft,
          last_saved_at: new Date().toISOString(),
          status: referee.status === "in_progress" ? referee.status : "in_progress",
        })
        .eq("id", referee.id);
      return json(200, { success: true, saved_at: new Date().toISOString() });
    }

    if (action === "submit_referee") {
      if (!(await rateLimitOk(supabase, "reference_submit_ip", ip, 20, 3600))) {
        return json(429, { error: "rate_limited" });
      }
      const answers = { ...(referee.draft_answers ?? {}), ...(body?.answers ?? {}) };
      const required = visibleQuestions(snapshot).filter(
        (q: any) => q.required && q.type !== "section_header",
      );
      const missing = required.filter((q: any) => {
        const v = answers[q.id];
        if (v === undefined || v === null || v === "") return true;
        if (Array.isArray(v)) return v.length === 0;
        if (typeof v === "object") return Object.values(v).every((x) => !x);
        return false;
      });
      if (missing.length > 0) {
        return json(400, { error: "missing_answers", question_ids: missing.map((q: any) => q.id) });
      }

      await supabase
        .from("reference_referees")
        .update({
          answers,
          draft_answers: answers,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          last_saved_at: new Date().toISOString(),
        })
        .eq("id", referee.id);

      await logReferenceActivity(
        supabase,
        ctx.request.id,
        "referee_submitted",
        `${referee.name} submitted their reference`,
      );

      // Roll the request state up: complete once every contactable referee is in.
      const { data: siblings } = await supabase
        .from("reference_referees")
        .select("status, on_hold")
        .eq("request_id", ctx.request.id);
      const contactable = (siblings ?? []).filter((r) => !r.on_hold);
      const done = contactable.filter((r) => r.status === "submitted").length;
      const nextState =
        contactable.length > 0 && done >= contactable.length ? "complete" : "partial";
      await supabase
        .from("reference_requests")
        .update({ state: nextState })
        .eq("id", ctx.request.id);

      return json(200, { success: true });
    }

    if (action === "decline") {
      const now = new Date().toISOString();
      await supabase
        .from("reference_referees")
        .update({
          status: "declined",
          declined_at: now,
          draft_answers: {},
          answers: {},
          pii_purge_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        })
        .eq("id", referee.id);
      await logReferenceActivity(
        supabase,
        ctx.request.id,
        "referee_declined",
        `${referee.name} declined to give a reference`,
      );
      await supabase
        .from("reference_requests")
        .update({ state: "attention" })
        .eq("id", ctx.request.id);
      return json(200, { success: true });
    }

    return NOT_FOUND();
  } catch (e) {
    console.error("[reference-public]", action, e);
    return json(500, { error: "internal_error" });
  }
});
