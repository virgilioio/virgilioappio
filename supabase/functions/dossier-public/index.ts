// Public candidate dossier, resolved by share token.
//
// Two actions, both anonymous:
//   resolve  — returns a CLIENT-READY payload only. Weights, contributions,
//              nulled dimensions, the weighted-mean total, rubric mechanics,
//              validation priorities, salary dimensions and salary validation
//              points are stripped HERE, server-side, so they never reach the
//              browser at all. There is no mode switch on the wire.
//   feedback — records the client's decision and tells the owning recruiter.
//
// A token that exists but is off/deactivated resolves to { state: 'deactivated' }
// so the page can render the canonical empty state. A token that never existed
// 404s — we do not confirm the existence of tokens that were never issued.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { marked } from "npm:marked@12.0.2";

const FROM = "Gio <noreply@app.gogio.io>";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const NOT_FOUND = () => json(404, { error: "not_found" });

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

const SALARY = /salary|compensation|remuneration|\bpay\b/i;
const MECHANICS = /points?|weight\w*|scor\w*|calculation|rubric/i;

/** Strips every internal-only field out of the stored analysis. */
function clientReadyAnalysis(raw: Record<string, unknown>) {
  const dimensions = (Array.isArray(raw.dimensions) ? raw.dimensions : [])
    .filter((d: any) => d && typeof d === "object")
    .filter((d: any) => d.score !== null && d.score !== undefined)
    .filter((d: any) => !SALARY.test(String(d.name ?? "")))
    .map((d: any) => ({
      // Deliberately absent: weight, contribution, verdict mechanics.
      name: String(d.name ?? ""),
      score: Number(d.score),
      insight: typeof d.insight === "string" ? d.insight : null,
      matches: Array.isArray(d.matches) ? d.matches.map(String) : [],
      gaps: Array.isArray(d.gaps) ? d.gaps.map(String) : [],
    }));

  const validation_points = (Array.isArray(raw.validation_points) ? raw.validation_points : [])
    .filter((p: any) => p && typeof p === "object")
    .filter((p: any) => !SALARY.test(`${p.question ?? ""} ${p.reason ?? ""}`))
    .map((p: any) => ({
      // No priority — the client has no use for our triage order.
      question: String(p.question ?? ""),
      reason: typeof p.reason === "string" && p.reason.trim() && !MECHANICS.test(p.reason)
        ? p.reason.trim()
        : "The written record does not settle this either way.",
      suggested_stage: typeof p.suggested_stage === "string" ? p.suggested_stage : "",
    }))
    .filter((p: any) => p.question);

  const skill_evidence = Array.isArray(raw.skill_evidence)
    ? raw.skill_evidence.map((entry: any) => ({
      skill: String(entry?.skill ?? ""),
      status: entry?.status,
      evidence: typeof entry?.evidence === "string" ? entry.evidence : null,
      source: typeof entry?.source === "string" ? entry.source : null,
    })).filter((entry: any) => entry.skill)
    : undefined;

  // Source languages only — the client cannot hover a provenance chip, so the
  // names of the languages the CV was written in travel with the payload.
  const detected = raw.detected_languages as any;
  const detected_languages = detected && Array.isArray(detected.sources)
    ? {
      sources: detected.sources
        .filter((s: any) => s && typeof s === "object")
        .map((s: any) => ({
          label: String(s.label ?? ""),
          code: String(s.code ?? ""),
          name: String(s.name ?? ""),
        }))
        .filter((s: any) => s.name),
    }
    : undefined;

  return {
    overall_score: Number(raw.overall_score ?? 0),
    confidence: raw.confidence ?? "medium",
    profile_summary: typeof raw.profile_summary === "string" ? raw.profile_summary : undefined,
    executive_summary: typeof raw.executive_summary === "string" ? raw.executive_summary : "",
    dimensions,
    validation_points,
    ...(skill_evidence ? { skill_evidence } : {}),
    ...(detected_languages ? { detected_languages } : {}),
  };
}

async function recruiterRecipients(supabase: any, jobId: string, createdBy: string | null) {
  const ids = new Set<string>();
  if (createdBy) ids.add(createdBy);
  const { data } = await supabase
    .from("job_assignments")
    .select("user_id, role")
    .eq("job_id", jobId)
    .is("deleted_at", null);
  for (const row of data ?? []) {
    if (row.role === "recruiter" && row.user_id) ids.add(row.user_id);
  }
  return [...ids];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return NOT_FOUND();

  const supabase = admin();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NOT_FOUND();
  }

  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const action = String(body?.action ?? "resolve");
  if (!token || !/^[a-f0-9]{8,64}$/i.test(token)) return NOT_FOUND();

  try {
    const { data: share } = await supabase
      .from("dossier_shares")
      .select("id, association_id, is_public, deactivated_at, deactivated_reason, view_count, last_viewed_at")
      .eq("token", token)
      .maybeSingle();

    // Never issued → a genuine 404.
    if (!share) return NOT_FOUND();

    const { data: assoc } = await supabase
      .from("job_candidate_associations")
      .select("id, job_id, candidate_id, status, current_stage_id, entered_stage_at, rejected_at, offered_at, hired_at")
      .eq("id", share.association_id)
      .maybeSingle();
    if (!assoc) return NOT_FOUND();

    const { data: job } = await supabase
      .from("jobs")
      .select("id, title, status, tenant_id, created_by, organization_id, must_have_skills, skills")
      .eq("id", assoc.job_id)
      .maybeSingle();
    if (!job) return NOT_FOUND();

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", job.tenant_id)
      .maybeSingle();
    const { data: careers } = await supabase
      .from("careers_page_settings")
      .select("logo_url")
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();

    const workspaceName = tenant?.name || "This agency";

    const terminalAssociation = ["rejected", "withdrawn"].includes(String(assoc.status ?? "").toLowerCase());
    const progressedAssociation = ["offer", "hired"].includes(String(assoc.status ?? "").toLowerCase());
    const live = share.is_public &&
      !share.deactivated_at &&
      !assoc.rejected_at &&
      !terminalAssociation &&
      (job.status === "open" || progressedAssociation);

    if (!live) {
      const { data: owner } = job.created_by
        ? await supabase.from("profiles").select("email").eq("user_id", job.created_by).maybeSingle()
        : { data: null };
      return json(200, {
        state: "deactivated",
        workspace_name: workspaceName,
        contact_email: owner?.email ?? null,
        brand: { agency_name: workspaceName, logo_url: careers?.logo_url ?? null },
      });
    }

    /* -------------------------------------------------------------- FEEDBACK */
    if (action === "feedback") {
      const decision = String(body?.decision ?? "");
      if (decision !== "interview_requested" && decision !== "not_a_fit") return NOT_FOUND();
      const note = typeof body?.note === "string" ? body.note.slice(0, 2000) : null;

      const { data: existing } = await supabase
        .from("dossier_feedback")
        .select("decision, created_at")
        .eq("share_id", share.id)
        .maybeSingle();
      if (existing) return json(409, { error: "decision_already_recorded" });

      const { data: row, error } = await supabase
        .from("dossier_feedback")
        .insert({ share_id: share.id, decision, note })
        .select("id, decision, created_at")
        .single();
      if (error) {
        if (error.code === "23505") return json(409, { error: "decision_already_recorded" });
        throw error;
      }

      const { data: candidate } = await supabase
        .from("candidates")
        .select("candidate_name")
        .eq("id", assoc.candidate_id)
        .maybeSingle();
      const candidateName = candidate?.candidate_name || "A candidate";
      const headline = decision === "interview_requested"
        ? `Interview requested for ${candidateName}`
        : `${candidateName} marked not a fit`;
      const actionUrl = `/jobs/${assoc.job_id}/candidates/${assoc.candidate_id}?tab=fit`;

      const recipients = await recruiterRecipients(supabase, assoc.job_id, job.created_by);
      for (const userId of recipients) {
        await supabase.rpc("emit_notification", {
          _user_id: userId,
          _tenant_id: job.tenant_id,
          _category: "mention",
          _actor_user_id: null,
          _actor_name: "Client",
          _actor_avatar_url: null,
          _title: headline,
          _subtitle: job.title ?? null,
          _preview: note || "Decision recorded from the shared dossier.",
          _entity_kind: "candidate",
          _entity_id: assoc.candidate_id,
          _job_id: assoc.job_id,
          _candidate_id: assoc.candidate_id,
          _action_url: actionUrl,
          _metadata: { dossier_share_id: share.id, decision },
        });
      }

      const key = Deno.env.get("RESEND_API_KEY");
      if (key && recipients.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .in("user_id", recipients);
        const to = (profiles ?? []).map((p: any) => p.email).filter(Boolean);
        if (to.length > 0) {
          try {
            await new Resend(key).emails.send({
              from: FROM,
              to,
              subject: headline,
              html:
                `<p style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#1F2230">` +
                `<strong>${headline}</strong><br/>${job.title ?? ""}</p>` +
                (note
                  ? `<p style="font-family:Inter,Arial,sans-serif;font-size:13px;color:#5A6072">“${
                    note.replace(/[<>]/g, "")
                  }”</p>`
                  : "") +
                `<p style="font-family:Inter,Arial,sans-serif;font-size:12px;color:#8B8F9E">Recorded from the dossier you shared.</p>`,
            } as never);
          } catch (mailError) {
            console.error("[dossier-public] email", mailError);
          }
        }
      }

      return json(200, { state: "recorded", decision: row.decision, created_at: row.created_at });
    }

    /* --------------------------------------------------------------- RESOLVE */
    const [{ data: candidate }, { data: experience }, { data: education }, { data: feedback }, { data: currentStage }, { data: offer }, { data: bookings }] =
      await Promise.all([
        supabase
          .from("candidates")
          .select("candidate_name, role_current, current_job_title, company_current, location_city, location_state, location_country, profile_summary, skills")
          .eq("id", assoc.candidate_id)
          .maybeSingle(),
        supabase
          .from("candidate_work_experience")
          .select("id, job_title, company_name, location, start_date, end_date, is_current, description, standardized_title")
          .eq("candidate_id", assoc.candidate_id)
          .order("is_current", { ascending: false })
          .order("start_date", { ascending: false }),
        supabase
          .from("candidate_education")
          .select("id, institution_name, degree_type, field_of_study, start_date, end_date")
          .eq("candidate_id", assoc.candidate_id)
          .order("end_date", { ascending: false }),
        supabase
          .from("dossier_feedback")
          .select("decision, created_at")
          .eq("share_id", share.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        assoc.current_stage_id
          ? supabase
            .from("job_hiring_stages")
            .select("custom_stage_name, job_stages(stage_name, stage_type)")
            .eq("id", assoc.current_stage_id)
            .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("offer_letters")
          .select("sent_at, updated_at, field_values")
          .eq("candidate_id", assoc.candidate_id)
          .eq("job_id", assoc.job_id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("scheduled_bookings")
          .select("scheduled_start, status, job_hiring_stage_id, booking_event_types(title)")
          .eq("job_candidate_association_id", assoc.id)
          .eq("status", "confirmed")
          .gte("scheduled_start", new Date().toISOString())
          .order("scheduled_start", { ascending: true })
          .limit(1),
      ]);

    const stageType = String((currentStage as any)?.job_stages?.stage_type ?? "");
    const latestFeedback = feedback as { decision?: string; created_at?: string } | null;
    let clientStage: "awaiting" | "requested" | "declined" | "interviewing" | "offer" | "hired" = "awaiting";
    let occurredAt: string | null = null;
    if (assoc.status === "hired" || assoc.hired_at) {
      clientStage = "hired";
      occurredAt = assoc.hired_at;
    } else if (assoc.status === "offer" || stageType === "offer" || assoc.offered_at) {
      clientStage = "offer";
      occurredAt = (offer as any)?.sent_at || assoc.offered_at || (offer as any)?.updated_at || assoc.entered_stage_at;
    } else if (stageType === "interview") {
      clientStage = "interviewing";
      occurredAt = assoc.entered_stage_at;
    } else if (latestFeedback?.decision === "interview_requested") {
      clientStage = "requested";
      occurredAt = latestFeedback.created_at ?? null;
    } else if (latestFeedback?.decision === "not_a_fit") {
      clientStage = "declined";
      occurredAt = latestFeedback.created_at ?? null;
    }
    const nextBooking = (bookings ?? [])[0] as any;
    const startDate = typeof (offer as any)?.field_values?.start_date === "string"
      ? (offer as any).field_values.start_date
      : null;

    const { data: assocFit } = await supabase
      .from("job_candidate_associations")
      .select("ai_fit_score, ai_fit_analysis, ai_fit_generated_at, ai_fit_output_language")
      .eq("id", assoc.id)
      .maybeSingle();

    const { data: scorecardRows } = await supabase
      .from("job_stage_scorecards")
      .select("id, stage_instance_id, created_by, rating, general_overview, created_at, updated_at, is_ai_draft")
      .eq("association_id", assoc.id)
      .eq("is_ai_draft", false)
      .not("rating", "is", null)
      .not("general_overview", "is", null)
      .order("created_at", { ascending: false });

    const submittedScorecards = (scorecardRows ?? []).filter((row: any) =>
      typeof row.general_overview === "string" && row.general_overview.trim().length > 0
    );
    const authorIds = [...new Set(submittedScorecards.map((row: any) => row.created_by).filter(Boolean))];
    const stageIds = [...new Set(submittedScorecards.map((row: any) => row.stage_instance_id).filter(Boolean))];
    const [{ data: authorProfiles }, { data: hiringStages }] = await Promise.all([
      authorIds.length
        ? supabase.from("profiles").select("user_id, first_name, last_name, title").in("user_id", authorIds)
        : Promise.resolve({ data: [] }),
      stageIds.length
        ? supabase.from("job_hiring_stages").select("id, custom_stage_name, stage_id").in("id", stageIds)
        : Promise.resolve({ data: [] }),
    ]);
    const baseStageIds = [...new Set((hiringStages ?? []).map((stage: any) => stage.stage_id).filter(Boolean))];
    const { data: baseStages } = baseStageIds.length
      ? await supabase.from("job_stages").select("id, stage_name").in("id", baseStageIds)
      : { data: [] };
    const authorById = new Map((authorProfiles ?? []).map((profile: any) => [profile.user_id, profile]));
    const baseStageById = new Map((baseStages ?? []).map((stage: any) => [stage.id, stage.stage_name]));
    const stageById = new Map((hiringStages ?? []).map((stage: any) => [
      stage.id,
      stage.custom_stage_name || baseStageById.get(stage.stage_id) || "Interview",
    ]));
    const sanitizeScorecardHtml = (value: string) => {
      const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(value);
      const rendered = hasHtmlTags ? value : marked.parse(value, { gfm: true, breaks: true });
      const html = typeof rendered === "string" ? rendered : value;
      return html
      .replace(/<!--([\s\S]*?)-->/g, "")
      .replace(/<(script|style|iframe|object|embed|svg|form)[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<(?!\/?(?:p|br|strong|b|em|i|u|h[1-6]|ul|ol|li|blockquote|div)\b)[^>]*>/gi, "")
      .replace(/<(p|br|strong|b|em|i|u|h[1-6]|ul|ol|li|blockquote|div)\b[^>]*>/gi, "<$1>")
      .replace(/<\/(p|strong|b|em|i|u|h[1-6]|ul|ol|li|blockquote|div)\s*>/gi, "</$1>");
    };

    const scorecards = submittedScorecards.map((row: any) => {
      const author = authorById.get(row.created_by) as any;
      const takeawayHtml = sanitizeScorecardHtml(String(row.general_overview));
      return {
        id: row.id,
        interviewerName: [author?.first_name, author?.last_name].filter(Boolean).join(" ") || "Interviewer",
        interviewerRole: author?.title || null,
        submittedAt: row.updated_at || row.created_at,
        stage: stageById.get(row.stage_instance_id) || "Interview",
        rating: row.rating,
        takeawayHtml,
        takeawayParagraphs: takeawayHtml
          .replace(/<\/(?:p|div|li|blockquote|h[1-6])>|<br\s*\/?>/gi, "\n")
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .split(/\n+/)
          .map((paragraph: string) => paragraph.replace(/\s+/g, " ").trim())
          .filter(Boolean),
      };
    });

    if (!assocFit?.ai_fit_analysis || assocFit.ai_fit_score === null) {
      return json(200, {
        state: "deactivated",
        workspace_name: workspaceName,
        contact_email: null,
        brand: { agency_name: workspaceName, logo_url: careers?.logo_url ?? null },
      });
    }

    // Read receipt, debounced by the caller (one per browser session).
    if (body?.count_view === true) {
      await supabase.rpc("record_dossier_view", { _token: token });
    }

    let preparedBy = workspaceName;
    if (job.created_by) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", job.created_by)
        .maybeSingle();
      const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
      if (full) preparedBy = full;
    }

    const requiredSkills = (Array.isArray(job.must_have_skills) && job.must_have_skills.length
      ? job.must_have_skills
      : Array.isArray(job.skills)
      ? job.skills
      : []).map(String);

    const roleLine = [
      candidate?.role_current || candidate?.current_job_title,
      candidate?.company_current,
    ].filter(Boolean).join(" at ");

    return json(200, {
      state: "live",
      brand: { agency_name: workspaceName, logo_url: careers?.logo_url ?? null },
      workspace_name: workspaceName,
      prepared_by: preparedBy,
      prepared_on: assocFit.ai_fit_generated_at ?? new Date().toISOString(),
      job_title: job.title ?? "",
      candidate: {
        name: candidate?.candidate_name ?? "Candidate",
        role_line: roleLine || null,
        location: [candidate?.location_city, candidate?.location_state, candidate?.location_country]
          .filter(Boolean).join(", ") || null,
        profile_summary: candidate?.profile_summary ?? null,
        skills: Array.isArray(candidate?.skills) ? candidate!.skills.map(String) : [],
      },
      required_skills: requiredSkills,
      score: Number(assocFit.ai_fit_score),
      output_language: assocFit.ai_fit_output_language ?? null,
      analysis: clientReadyAnalysis(assocFit.ai_fit_analysis as Record<string, unknown>),
      work_experience: experience ?? [],
      education: education ?? [],
      scorecards,
      feedback: feedback ?? null,
      client_stage: {
        key: clientStage,
        occurred_at: occurredAt,
        next_interview_at: nextBooking?.scheduled_start ?? null,
        next_interview_label: nextBooking?.booking_event_types?.title || (currentStage as any)?.custom_stage_name || (currentStage as any)?.job_stages?.stage_name || null,
        start_date: startDate,
      },
    });
  } catch (error) {
    console.error("[dossier-public]", error);
    return json(500, { error: "server_error" });
  }
});
