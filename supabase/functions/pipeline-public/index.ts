// Public client pipeline, resolved by share token. Anonymous.
//
//   board    — shared stages with a deliberately small per-candidate object.
//   dossier  — the same client-ready dossier /d/:token serves (delegated to
//              dossier-public), with the pipeline's display toggles on top.
//   feedback — records a decision in the dossier decision store, source=pipeline_link.
//
// Token never issued → 404. Token exists but off / job not open → unavailable.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const NOT_FOUND = () => json(404, { error: "not_found" });

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const URL_ = Deno.env.get("SUPABASE_URL") ?? "";
const admin = () => createClient(URL_, SERVICE_KEY, { auth: { persistSession: false } });

const NON_RECRUITING = new Set(["application", "application_review", "offer", "onboarding"]);
const STAGE_COLOR: Record<string, string> = {
  screening: "#0EA5E9", assessment: "#EC4899", interview: "#6F3FF5", reference_check: "#12B886",
};
const FALLBACK = ["#0EA5E9", "#EC4899", "#6F3FF5", "#F59E0B", "#12B886"];

const viewSeen = new Map<string, number>();

async function slugFor(name: string, associationId: string) {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "candidate";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(associationId)));
  const suffix = ((digest[0] << 8) | digest[1]).toString(36).padStart(3, "0").slice(-3);
  return `${base}-${suffix}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => `${p[0].toUpperCase()}.`).join(" ") || "—";
}

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

    const { data: job } = await supabase.from("jobs")
      .select("id, title, status, tenant_id, created_by, organization_id").eq("id", ps.job_id).maybeSingle();
    if (!job) return NOT_FOUND();

    const [{ data: tenant }, { data: careers }, { data: org }] = await Promise.all([
      supabase.from("tenants").select("name").eq("id", job.tenant_id).maybeSingle(),
      supabase.from("careers_page_settings").select("logo_url").eq("tenant_id", job.tenant_id).maybeSingle(),
      job.organization_id
        ? supabase.from("organizations").select("name").eq("id", job.organization_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const workspaceName = tenant?.name || "This agency";
    const brand = { agency_name: workspaceName, logo_url: careers?.logo_url ?? null };
    const clientName = (org as any)?.name || null;

    if (!ps.is_public || job.status !== "open") {
      return json(200, {
        state: "unavailable",
        reason: job.status !== "open" ? "job_closed" : "off",
        brand, workspace_name: workspaceName, client_name: clientName, job_title: job.title ?? "",
      });
    }

    // Stages in pipeline order; shared = recruiting stages from the start onward.
    const { data: stageRows } = await supabase.from("job_hiring_stages")
      .select("id, position, custom_stage_name, job_stages(stage_name, stage_type)")
      .eq("job_id", job.id).order("position", { ascending: true });
    const recruiting = (stageRows ?? []).filter((s: any) => !NON_RECRUITING.has(String(s.job_stages?.stage_type ?? "")));
    // Per-stage selection: only stages explicitly listed are shared. Falls back to
    // the legacy from_stage_id slice for shares not yet backfilled.
    const selectedIds: string[] | null = Array.isArray(ps.visible_stage_ids) && ps.visible_stage_ids.length
      ? ps.visible_stage_ids
      : null;
    let visibleRows = recruiting;
    if (selectedIds) {
      const sel = new Set(selectedIds);
      visibleRows = recruiting.filter((s: any) => sel.has(s.id));
    } else {
      let startIdx = recruiting.findIndex((s: any) => s.id === ps.from_stage_id);
      if (startIdx < 0) startIdx = 0;
      visibleRows = recruiting.slice(startIdx);
    }
    const shared = visibleRows.map((s: any, i: number) => ({
      id: s.id,
      name: s.custom_stage_name || s.job_stages?.stage_name || "Stage",
      type: String(s.job_stages?.stage_type ?? ""),
      color: STAGE_COLOR[String(s.job_stages?.stage_type ?? "")] ?? FALLBACK[i % FALLBACK.length],
    }));
    const sharedIds = shared.map((s) => s.id);

    const { data: assocs } = sharedIds.length
      ? await supabase.from("job_candidate_associations")
        .select("id, candidate_id, status, current_stage_id, entered_stage_at, created_at, ai_fit_score, pipeline_position")
        .eq("job_id", job.id).in("current_stage_id", sharedIds)
      : { data: [] as any[] };
    const live = (assocs ?? []).filter((a: any) =>
      !["rejected", "withdrawn", "hired", "offer", "offered"].includes(String(a.status ?? "").toLowerCase())
    );

    const candIds = [...new Set(live.map((a: any) => a.candidate_id))];
    const assocIds = live.map((a: any) => a.id);

    // Booked interviews for the candidates' current stages (same filter the
    // internal pipeline uses) — the public card shows the date when one exists.
    const nowMs = Date.now();
    const { data: bookingRows } = candIds.length
      ? await supabase.from("scheduled_bookings")
        .select("candidate_id, job_hiring_stage_id, scheduled_start, status")
        .in("candidate_id", candIds)
        .in("job_hiring_stage_id", sharedIds)
        .in("status", ["confirmed", "rescheduled"])
      : { data: [] as any[] };
    const bookingByCandidateStage = new Map<string, number>();
    for (const b of bookingRows ?? []) {
      const key = `${b.candidate_id}:${b.job_hiring_stage_id}`;
      const ms = new Date(b.scheduled_start).getTime();
      const prev = bookingByCandidateStage.get(key);
      // Prefer the soonest upcoming; otherwise the most recent overdue.
      if (prev === undefined || (ms >= nowMs && (prev < nowMs || ms < prev)) || (ms < nowMs && prev < nowMs && ms > prev)) {
        bookingByCandidateStage.set(key, ms);
      }
    }
    const DAY_MS = 86400000;
    const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const dayLabel = (ms: number) => {
      const diff = Math.round((startOfDay(ms) - startOfDay(nowMs)) / DAY_MS);
      if (diff === 0) return "Today";
      if (diff === 1) return "Tomorrow";
      if (diff === -1) return "Yesterday";
      return new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    };
    const timeLabel = (ms: number) =>
      new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    const [{ data: cands }, { data: shares }] = await Promise.all([
      candIds.length
        ? supabase.from("candidates").select("id, candidate_name, role_current, current_job_title, company_current, deleted_at").in("id", candIds)
        : Promise.resolve({ data: [] as any[] }),
      assocIds.length
        ? supabase.from("dossier_shares").select("id, association_id").in("association_id", assocIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const shareIds = (shares ?? []).map((s: any) => s.id);
    const { data: feedbackRows } = shareIds.length
      ? await supabase.from("dossier_feedback").select("share_id, decision, created_at").in("share_id", shareIds)
      : { data: [] as any[] };
    const decisionByAssoc = new Map<string, string>();
    for (const s of shares ?? []) {
      const f = (feedbackRows ?? []).find((r: any) => r.share_id === s.id);
      if (f) decisionByAssoc.set(s.association_id, f.decision);
    }
    const candById = new Map((cands ?? []).filter((c: any) => !c.deleted_at).map((c: any) => [c.id, c]));

    const entries = [] as any[];
    for (const a of live) {
      const c = candById.get(a.candidate_id) as any;
      if (!c) continue;
      const stage = shared.find((s) => s.id === a.current_stage_id)!;
      const name = String(c.candidate_name || "Candidate");
      const decision = decisionByAssoc.get(a.id);
      const bookedMs = bookingByCandidateStage.get(`${a.candidate_id}:${stage.id}`);
      const clientStage = decision === "not_a_fit" ? "declined"
        : decision === "interview_requested" ? "requested"
        : bookedMs !== undefined ? "scheduled"
        : stage.type === "interview" ? "interviewing" : "awaiting";
      const entered = a.entered_stage_at || a.created_at;
      entries.push({
        association_id: a.id,
        stage_id: stage.id,
        position: a.pipeline_position ?? 0,
        full_name: name,
        card: {
          slug: await slugFor(name, a.id),
          display_name: ps.initials_only ? initials(name) : name,
          title: c.role_current || c.current_job_title || null,
          ...(ps.show_employer ? { company: c.company_current || null } : {}),
          ...(ps.show_fit_score && typeof a.ai_fit_score === "number" ? { fit_score: Math.round(a.ai_fit_score) } : {}),
          ...(ps.show_days && entered ? { days_in_stage: Math.max(0, Math.floor((Date.now() - new Date(entered).getTime()) / 86400000)) } : {}),
          ...(ps.show_client_status ? { client_stage: clientStage } : {}),
          stage_name: stage.name,
          _decision: decision ?? null,
        },
      });
    }
    entries.sort((x, y) => x.position - y.position);

    const ordered = shared.flatMap((s) => entries.filter((e) => e.stage_id === s.id));
    const meta = {
      brand, workspace_name: workspaceName, client_name: clientName, job_title: job.title ?? "",
      from_stage: shared[0]?.name ?? null, client_can_respond: ps.client_can_respond,
    };

    if (action === "board") {
      const key = `${token}|${req.headers.get("x-forwarded-for") ?? ""}|${req.headers.get("user-agent") ?? ""}`;
      const last = viewSeen.get(key) ?? 0;
      if (body?.count_view === true && Date.now() - last > 30 * 60 * 1000) {
        viewSeen.set(key, Date.now());
        await supabase.from("job_pipeline_shares")
          .update({ view_count: (ps.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() }).eq("id", ps.id);
      }
      return json(200, {
        state: "live", ...meta,
        stages: shared.map((s) => ({
          name: s.name, color: s.color,
          candidates: ordered.filter((e) => e.stage_id === s.id).map((e) => { const { _decision, ...card } = e.card; return card; }),
        })),
      });
    }

    const slug = String(body?.slug ?? "");
    const idx = ordered.findIndex((e) => e.card.slug === slug);
    if (idx < 0) return NOT_FOUND();
    const entry = ordered[idx];

    if (action === "feedback") {
      const decision = String(body?.decision ?? "");
      const reasons = Array.isArray(body?.reasons)
        ? body.reasons.filter((r: unknown) => typeof r === "string").slice(0, 12).map((r: string) => r.slice(0, 80)) : [];
      const note = typeof body?.note === "string" ? body.note.slice(0, 2000) : null;
      const { data, error } = await supabase.rpc("record_pipeline_decision", {
        _token: token, _association_id: entry.association_id, _decision: decision,
        _reasons: reasons, _note: note, _user_agent: req.headers.get("user-agent"),
      });
      if (error) throw error;
      const r = (data ?? {}) as any;
      if (r.error === "decision_already_recorded") return json(409, { error: r.error });
      if (r.error) return NOT_FOUND();
      return json(200, { state: "recorded", decision: r.decision, created_at: r.created_at, reasons, note });
    }

    // dossier: make sure a share row exists (off by default), then delegate.
    const { data: existing } = await supabase.from("dossier_shares").select("id").eq("association_id", entry.association_id).maybeSingle();
    if (!existing) {
      await supabase.from("dossier_shares").insert({ association_id: entry.association_id, created_by: ps.created_by });
    }
    const res = await fetch(`${URL_}/functions/v1/dossier-public`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "x-internal-key": SERVICE_KEY },
      body: JSON.stringify({ action: "internal_resolve", association_id: entry.association_id }),
    });
    if (!res.ok) return NOT_FOUND();
    const dossier = await res.json();
    if (dossier?.state !== "live") return NOT_FOUND();

    if (ps.initials_only) dossier.candidate.name = entry.card.display_name;
    if (!ps.show_employer && dossier.candidate) {
      dossier.candidate.role_line = entry.card.title ?? null;
      dossier.work_experience = (dossier.work_experience ?? []).map((w: any) => w.is_current ? { ...w, company_name: "" } : w);
    }
    if (!ps.show_scorecards) dossier.scorecards = [];
    if (!ps.client_can_respond) dossier.responses_disabled = true;

    // Activity: first open per candidate per 24h.
    if (body?.count_view === true && job.created_by) {
      const since = new Date(Date.now() - 86400000).toISOString();
      const { data: recent } = await supabase.from("activities").select("id")
        .eq("activity_type", "client_dossier_viewed").eq("entity_id", (live.find((a: any) => a.id === entry.association_id) as any).candidate_id)
        .gte("created_at", since).contains("metadata", { source: "pipeline_link" }).limit(1);
      if (!recent?.length) {
        const cid = (live.find((a: any) => a.id === entry.association_id) as any).candidate_id;
        await supabase.from("activities").insert({
          user_id: job.created_by, organization_id: job.organization_id, tenant_id: job.tenant_id,
          activity_type: "client_dossier_viewed", title: "Client opened the dossier",
          description: "via the client pipeline", entity_type: "candidate", entity_id: cid,
          metadata: { job_id: job.id, candidate_id: cid, source: "pipeline_link", actor_label: "via the client pipeline" },
        });
      }
    }

    const nav = (e: any) => e ? { slug: e.card.slug, name: e.card.display_name } : null;
    return json(200, {
      ...dossier, pipeline: { ...meta, index: idx, total: ordered.length, prev: nav(ordered[idx - 1]), next: nav(ordered[idx + 1]), stage_name: entry.card.stage_name },
    });
  } catch (error) {
    console.error("[pipeline-public]", error);
    return json(500, { error: "server_error" });
  }
});
