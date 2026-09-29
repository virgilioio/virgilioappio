// Public client pipeline, resolved by share token. Anonymous reads are strictly
// allowlisted here; underlying candidate, offer and rejection tables stay private.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const NOT_FOUND = () => json(404, { error: "not_found" });
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const URL_ = Deno.env.get("SUPABASE_URL") ?? "";
const admin = () => createClient(URL_, SERVICE_KEY, { auth: { persistSession: false } });
const NON_RECRUITING = new Set(["application_review", "offer", "onboarding"]);
const SECTION_KEYS = ["application", "recruiting", "offers", "hired", "rejected"] as const;
type SectionKey = typeof SECTION_KEYS[number];
const STAGE_COLOR: Record<string, string> = { screening: "#0EA5E9", assessment: "#EC4899", interview: "#6F3FF5", reference_check: "#12B886" };
const FALLBACK = ["#0EA5E9", "#EC4899", "#6F3FF5", "#F59E0B", "#12B886"];
const viewSeen = new Map<string, number>();

async function slugFor(name: string, associationId: string) {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "candidate";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(associationId)));
  return `${base}-${((digest[0] << 8) | digest[1]).toString(36).padStart(3, "0").slice(-3)}`;
}
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => `${p[0].toUpperCase()}.`).join(" ") || "—";
const iso = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return NOT_FOUND();
  let body: any;
  try { body = await req.json(); } catch { return NOT_FOUND(); }
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const action = String(body?.action ?? "board");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return NOT_FOUND();
  const supabase = admin();

  try {
    const { data: ps } = await supabase.from("job_pipeline_shares").select("*").eq("token", token).maybeSingle();
    if (!ps) return NOT_FOUND();
    const { data: job } = await supabase.from("jobs").select("id, title, status, tenant_id, created_by, organization_id").eq("id", ps.job_id).maybeSingle();
    if (!job) return NOT_FOUND();
    const [{ data: tenant }, { data: careers }, { data: org }] = await Promise.all([
      supabase.from("tenants").select("name").eq("id", job.tenant_id).maybeSingle(),
      supabase.from("careers_page_settings").select("logo_url").eq("tenant_id", job.tenant_id).maybeSingle(),
      job.organization_id ? supabase.from("organizations").select("name").eq("id", job.organization_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const workspaceName = tenant?.name || "This agency";
    const brand = { agency_name: workspaceName, logo_url: careers?.logo_url ?? null };
    const clientName = (org as any)?.name || null;
    if (!ps.is_public || job.status !== "open") return json(200, { state: "unavailable", reason: job.status !== "open" ? "job_closed" : "off", brand, workspace_name: workspaceName, client_name: clientName, job_title: job.title ?? "" });

    const { data: stageRows } = await supabase.from("job_hiring_stages").select("id, position, custom_stage_name, job_stages(stage_name, stage_type)").eq("job_id", job.id).order("position");
    const stages = (stageRows ?? []).map((s: any, i: number) => ({ id: s.id, position: s.position ?? i, name: s.custom_stage_name || s.job_stages?.stage_name || "Stage", type: String(s.job_stages?.stage_type ?? "") }));
    const stageById = new Map(stages.map((s) => [s.id, s]));
    const recruiting = stages.filter((s) => !NON_RECRUITING.has(s.type));
    const selectedIds = Array.isArray(ps.visible_stage_ids) && ps.visible_stage_ids.length ? ps.visible_stage_ids : null;
    let visibleRecruiting = recruiting;
    if (selectedIds) { const selected = new Set(selectedIds); visibleRecruiting = recruiting.filter((s) => selected.has(s.id)); }
    else { const start = Math.max(0, recruiting.findIndex((s) => s.id === ps.from_stage_id)); visibleRecruiting = recruiting.slice(start); }
    const visibleStageIds = new Set(visibleRecruiting.map((s) => s.id));

    const sharedKeys = SECTION_KEYS.filter((key) => key === "recruiting" || !!ps[`share_${key}`]);
    const requested = SECTION_KEYS.includes(String(body?.section) as SectionKey) ? String(body.section) as SectionKey : "recruiting";
    const activeSection: SectionKey = sharedKeys.includes(requested) ? requested : "recruiting";

    const { data: assocRows } = await supabase.from("job_candidate_associations")
      .select("id, candidate_id, status, current_stage_id, entered_stage_at, created_at, updated_at, ai_fit_score, pipeline_position, rejected_at, offered_at, hired_at, rejection_reason_id")
      .eq("job_id", job.id);
    const assocs = assocRows ?? [];
    const sectionFor = (a: any): SectionKey | null => {
      const status = String(a.status ?? "").toLowerCase();
      const type = stageById.get(a.current_stage_id)?.type;
      if (status === "rejected" || status === "withdrawn") return "rejected";
      if (status === "hired") return "hired";
      if (["offer", "offered"].includes(status) || type === "offer") return "offers";
      if (type === "application_review") return "application";
      if (a.current_stage_id && visibleStageIds.has(a.current_stage_id)) return "recruiting";
      return null;
    };
    const visibleAssocs = assocs.filter((a: any) => { const section = sectionFor(a); return section && sharedKeys.includes(section); });
    const candidateIds = [...new Set(visibleAssocs.map((a: any) => a.candidate_id))];
    const associationIds = visibleAssocs.map((a: any) => a.id);
    const reasonIds = [...new Set(visibleAssocs.map((a: any) => a.rejection_reason_id).filter(Boolean))];

    const [{ data: candidates }, { data: dossierShares }, { data: offers }, { data: history }, { data: reasons }, { data: bookings }] = await Promise.all([
      candidateIds.length ? supabase.from("candidates").select("id, candidate_name, role_current, current_job_title, company_current, deleted_at").in("id", candidateIds) : Promise.resolve({ data: [] }),
      associationIds.length ? supabase.from("dossier_shares").select("id, association_id").in("association_id", associationIds) : Promise.resolve({ data: [] }),
      ps.share_offers && candidateIds.length ? supabase.from("offer_letters").select("candidate_id, status, sent_at, created_at, updated_at, field_values").eq("job_id", job.id).in("candidate_id", candidateIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
      ps.share_rejected && associationIds.length ? supabase.from("job_candidate_stage_history").select("association_id, to_stage_id, moved_at").in("association_id", associationIds).order("moved_at") : Promise.resolve({ data: [] }),
      ps.share_rejected && ps.show_reject_reason && reasonIds.length ? supabase.from("rejection_reasons").select("id, category, client_label").in("id", reasonIds) : Promise.resolve({ data: [] }),
      candidateIds.length ? supabase.from("scheduled_bookings").select("candidate_id, job_hiring_stage_id, scheduled_start, status").in("candidate_id", candidateIds).in("status", ["confirmed", "rescheduled"]) : Promise.resolve({ data: [] }),
    ]);
    const shareIds = (dossierShares ?? []).map((s: any) => s.id);
    const { data: feedbackRows } = shareIds.length ? await supabase.from("dossier_feedback").select("share_id, decision, created_at").in("share_id", shareIds) : { data: [] };
    const candidateById = new Map((candidates ?? []).filter((c: any) => !c.deleted_at).map((c: any) => [c.id, c]));
    const shareByAssoc = new Map((dossierShares ?? []).map((s: any) => [s.association_id, s.id]));
    const feedbackByShare = new Map((feedbackRows ?? []).map((f: any) => [f.share_id, f]));
    const offerByCandidate = new Map<string, any>();
    for (const offer of offers ?? []) if (!offerByCandidate.has(offer.candidate_id)) offerByCandidate.set(offer.candidate_id, offer);
    const reasonById = new Map((reasons ?? []).map((r: any) => [r.id, r]));
    const reachedByAssoc = new Map<string, string>();
    for (const h of history ?? []) { const name = stageById.get(h.to_stage_id)?.name; if (name) reachedByAssoc.set(h.association_id, name); }
    const nowMs = Date.now();
    const bookingByCandidateStage = new Map<string, number>();
    for (const b of bookings ?? []) {
      const key = `${b.candidate_id}:${b.job_hiring_stage_id}`; const ms = Date.parse(b.scheduled_start); const prev = bookingByCandidateStage.get(key);
      if (Number.isNaN(ms)) continue;
      if (prev === undefined || (ms >= nowMs && (prev < nowMs || ms < prev)) || (ms < nowMs && prev < nowMs && ms > prev)) bookingByCandidateStage.set(key, ms);
    }

    const rowsBySection: Record<SectionKey, any[]> = { application: [], recruiting: [], offers: [], hired: [], rejected: [] };
    for (const a of visibleAssocs) {
      const section = sectionFor(a); const c = candidateById.get(a.candidate_id) as any;
      if (!section || !c) continue;
      const name = String(c.candidate_name || "Candidate");
      const stage = stageById.get(a.current_stage_id);
      const feedback = feedbackByShare.get(shareByAssoc.get(a.id)) as any;
      const bookedMs = stage ? bookingByCandidateStage.get(`${a.candidate_id}:${stage.id}`) : undefined;
      const clientStage = feedback?.decision === "not_a_fit" ? "declined" : feedback?.decision === "interview_requested" ? "requested" : bookedMs !== undefined ? "scheduled" : stage?.type === "interview" ? "interviewing" : "awaiting";
      const base = {
        association_id: a.id,
        candidate_id: a.candidate_id,
        slug: await slugFor(name, a.id),
        display_name: ps.initials_only ? initials(name) : name,
        title: c.role_current || c.current_job_title || null,
        ...(ps.show_employer ? { company: c.company_current || null } : {}),
        ...(ps.show_fit_score && typeof a.ai_fit_score === "number" ? { fit_score: Math.round(a.ai_fit_score) } : {}),
        client_stage: clientStage,
        position: a.pipeline_position ?? 0,
      };
      if (section === "recruiting") {
        const entered = a.entered_stage_at || a.created_at;
        rowsBySection.recruiting.push({ ...base, stage_id: stage?.id, stage_name: stage?.name || "Stage", ...(ps.show_days && entered ? { days_in_stage: Math.max(0, Math.floor((Date.now() - Date.parse(entered)) / 86400000)) } : {}), ...(ps.show_client_status ? { public_status: clientStage } : {}), ...(ps.show_client_status && clientStage === "scheduled" && bookedMs !== undefined ? { scheduled_start: new Date(bookedMs).toISOString() } : {}) });
      } else if (section === "application") {
        rowsBySection.application.push({ ...base, applied_at: iso(a.created_at), ...(ps.show_client_status ? { public_status: clientStage } : {}) });
      } else if (section === "offers") {
        const offer = offerByCandidate.get(a.candidate_id); const offerState = String(offer?.status || "draft").toLowerCase();
        const statusLabel = offerState === "sent" ? "Awaiting their response" : /negotiat|counter/.test(offerState) ? "In discussion" : "Being prepared";
        rowsBySection.offers.push({ ...base, offered_at: iso(offer?.sent_at || a.offered_at || offer?.created_at), ...(ps.show_client_status ? { offer_status: statusLabel } : {}) });
      } else if (section === "hired") {
        const offer = offerByCandidate.get(a.candidate_id);
        rowsBySection.hired.push({ ...base, accepted_at: iso(a.hired_at || a.updated_at), start_date: typeof offer?.field_values?.start_date === "string" ? offer.field_values.start_date : null });
      } else {
        const reason = reasonById.get(a.rejection_reason_id) as any;
        const reasonLabel = reason?.category === "candidate_declined" || String(a.status).toLowerCase() === "withdrawn" ? "Withdrew" : reason?.client_label?.trim() || "Not progressed";
        rowsBySection.rejected.push({ ...base, reached_stage: reachedByAssoc.get(a.id) || stage?.name || null, closed_at: iso(a.rejected_at || a.updated_at), ...(ps.show_reject_reason ? { rejection_reason: reasonLabel } : {}) });
      }
    }

    const priority: Record<string, number> = { scheduled: 1, awaiting: 2, interviewing: 3, requested: 4, declined: 5 };
    rowsBySection.recruiting.sort((x, y) => { const p = (priority[x.public_status] ?? 9) - (priority[y.public_status] ?? 9); if (p) return p; if (x.public_status === "scheduled") return Date.parse(x.scheduled_start) - Date.parse(y.scheduled_start); return x.position - y.position; });
    rowsBySection.application.sort((a, b) => (b.fit_score ?? -1) - (a.fit_score ?? -1));
    rowsBySection.offers.sort((a, b) => Date.parse(b.offered_at || 0) - Date.parse(a.offered_at || 0));
    rowsBySection.hired.sort((a, b) => Date.parse(b.accepted_at || 0) - Date.parse(a.accepted_at || 0));
    rowsBySection.rejected.sort((a, b) => Date.parse(b.closed_at || 0) - Date.parse(a.closed_at || 0));

    const publicRows = (section: SectionKey) => rowsBySection[section].map(({ association_id, candidate_id, position, client_stage, ...row }) => row);
    const stagePayload = visibleRecruiting.map((s, i) => ({ name: s.name, color: STAGE_COLOR[s.type] ?? FALLBACK[i % FALLBACK.length], candidates: publicRows("recruiting").filter((r: any) => r.stage_id === s.id).map(({ stage_id, ...r }: any) => r) }));
    const sectionMeta = sharedKeys.map((key) => ({ key, label: key === "application" ? "Application review" : key === "recruiting" ? "Recruiting process" : key === "offers" ? "Job offers" : key === "hired" ? "Hired" : "Rejected", count: rowsBySection[key].length }));
    const meta = { brand, workspace_name: workspaceName, client_name: clientName, job_title: job.title ?? "", client_can_respond: !!ps.client_can_respond, active_section: activeSection, sections: sectionMeta };

    if (action === "board") {
      const key = `${token}|${req.headers.get("x-forwarded-for") ?? ""}|${req.headers.get("user-agent") ?? ""}`; const last = viewSeen.get(key) ?? 0;
      if (body?.count_view === true && Date.now() - last > 30 * 60 * 1000) { viewSeen.set(key, Date.now()); await supabase.from("job_pipeline_shares").update({ view_count: (ps.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() }).eq("id", ps.id); }
      return json(200, { state: "live", ...meta, ...(activeSection === "recruiting" ? { stages: stagePayload } : { rows: publicRows(activeSection) }), show_fit_score: !!ps.show_fit_score, show_employer: !!ps.show_employer, show_client_status: !!ps.show_client_status, show_reject_reason: !!ps.show_reject_reason });
    }

    const sectionRows = rowsBySection[activeSection];
    const slug = String(body?.slug ?? ""); const idx = sectionRows.findIndex((e) => e.slug === slug);
    if (idx < 0) return NOT_FOUND();
    const entry = sectionRows[idx];
    if (action === "feedback") {
      if (!ps.client_can_respond || !["application", "recruiting"].includes(activeSection) || entry.client_stage !== "awaiting") return NOT_FOUND();
      const decision = String(body?.decision ?? "");
      const reasonsInput = Array.isArray(body?.reasons) ? body.reasons.filter((r: unknown) => typeof r === "string").slice(0, 12).map((r: string) => r.slice(0, 80)) : [];
      const note = typeof body?.note === "string" ? body.note.slice(0, 2000) : null;
      const { data, error } = await supabase.rpc("record_pipeline_decision", { _token: token, _association_id: entry.association_id, _decision: decision, _reasons: reasonsInput, _note: note, _user_agent: req.headers.get("user-agent") });
      if (error) throw error; const result = (data ?? {}) as any;
      if (result.error === "decision_already_recorded") return json(409, { error: result.error });
      if (result.error) return NOT_FOUND();
      return json(200, { state: "recorded", decision: result.decision, created_at: result.created_at, reasons: reasonsInput, note });
    }

    const { data: existing } = await supabase.from("dossier_shares").select("id").eq("association_id", entry.association_id).maybeSingle();
    if (!existing) await supabase.from("dossier_shares").insert({ association_id: entry.association_id, created_by: ps.created_by });
    const res = await fetch(`${URL_}/functions/v1/dossier-public`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "x-internal-key": SERVICE_KEY }, body: JSON.stringify({ action: "internal_resolve", association_id: entry.association_id, pipeline_section: activeSection }) });
    if (!res.ok) return NOT_FOUND();
    const dossier = await res.json();
    const nav = (e: any) => e ? { slug: e.slug, name: e.display_name } : null;
    const navPayload = { ...meta, section: activeSection, section_name: sectionMeta.find((s) => s.key === activeSection)?.label, index: idx, total: sectionRows.length, prev: nav(sectionRows[(idx - 1 + sectionRows.length) % sectionRows.length]), next: nav(sectionRows[(idx + 1) % sectionRows.length]), stage_name: activeSection === "recruiting" ? entry.stage_name : null };
    if (dossier?.state === "preparing") {
      await supabase.from("fit_analysis_queue").upsert({ association_id: entry.association_id }, { onConflict: "association_id", ignoreDuplicates: true });
      fetch(`${URL_}/functions/v1/process-fit-queue`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SERVICE_KEY }, body: JSON.stringify({ source: "client_open" }) }).catch(() => {});
      return json(200, { state: "preparing", brand: dossier.brand, workspace_name: dossier.workspace_name, candidate_name: entry.display_name, pipeline: navPayload });
    }
    if (dossier?.state !== "live") return NOT_FOUND();
    if (ps.initials_only) dossier.candidate.name = entry.display_name;
    if (!ps.show_employer && dossier.candidate) { dossier.candidate.role_line = entry.title ?? null; dossier.work_experience = (dossier.work_experience ?? []).map((w: any) => w.is_current ? { ...w, company_name: "" } : w); }
    if (!ps.show_scorecards) dossier.scorecards = [];
    if (!ps.client_can_respond || !["application", "recruiting"].includes(activeSection) || entry.client_stage !== "awaiting") dossier.responses_disabled = true;
    if (body?.count_view === true && job.created_by) {
      const since = new Date(Date.now() - 86400000).toISOString();
      const { data: recent } = await supabase.from("activities").select("id").eq("activity_type", "client_dossier_viewed").eq("entity_id", entry.candidate_id).gte("created_at", since).contains("metadata", { source: "pipeline_link" }).limit(1);
      if (!recent?.length) await supabase.from("activities").insert({ user_id: job.created_by, organization_id: job.organization_id, tenant_id: job.tenant_id, activity_type: "client_dossier_viewed", title: "Client opened the dossier", description: "via the client pipeline", entity_type: "candidate", entity_id: entry.candidate_id, metadata: { job_id: job.id, candidate_id: entry.candidate_id, source: "pipeline_link", actor_label: "via the client pipeline" } });
    }
    return json(200, { ...dossier, pipeline: navPayload });
  } catch (error) { console.error("[pipeline-public]", error); return json(500, { error: "server_error" }); }
});
