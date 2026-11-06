// Prepares Gio Fit dossiers for candidates on live client pipelines, and
// re-scores a pipeline when a scorecard is submitted (reason = 'rescore',
// 2026-10-14). Woken on enqueue (DB trigger), when a client opens a candidate
// that is still being prepared, when a job's description is written, and by
// the fit-queue-sweep schedule.
//
// One candidate per run (2026-11-06): an assessment takes about a minute and a
// run is cut off at 150s, so a batch of five never finished and its lease was
// never released. Each run scores one, releases the lease and starts the next
// run while due work remains. The lease (170s) outlives a run, so two workers
// never overlap, and a run that was cut off frees it within three minutes.
//
// Candidates on a job without a description wait (status 'waiting') instead of
// being closed unscored; jobs_z_fit_queue_release puts them back when one is
// written.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { hasDescription, outcomeOf } from "../_shared/fitQueue.ts";

const URL_ = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const MAX_ATTEMPTS = 4;
const HOP_DELAY_MS = 2_000;
const LEASE_SECONDS = 170;
/** A chain of runs stops here; the sweep schedule starts a new one. */
const MAX_HOPS = 120;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const hops = Math.max(0, Math.min(MAX_HOPS, Number(body?.hops ?? MAX_HOPS)));

  const sb = createClient(URL_, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: got } = await sb.rpc("fit_queue_acquire_lease", { _seconds: LEASE_SECONDS });
  if (!got) return json(200, { skipped: "busy_or_paused" });

  const now = () => new Date().toISOString();
  const release = () => sb.from("fit_analysis_queue_control").update({ lease_until: null, updated_at: now() }).eq("id", 1);
  const pause = (reason: string) => sb.from("fit_analysis_queue_control")
    .update({ paused_reason: reason, paused_at: now(), lease_until: null }).eq("id", 1);
  const setRow = (id: string, fields: Record<string, unknown>) =>
    sb.from("fit_analysis_queue").update({ ...fields, updated_at: now() }).eq("id", id);

  let processed = 0;
  let rateLimited = false;
  try {
    const { data: items } = await sb.from("fit_analysis_queue").select("id, association_id, attempts, reason")
      .eq("status", "pending").lte("next_attempt_at", now())
      .order("created_at").limit(1);

    for (const item of items ?? []) {
      const { data: a } = await sb.from("job_candidate_associations")
        .select("candidate_id, job_id, status, ai_fit_analysis, jobs(description)").eq("id", item.association_id).maybeSingle();
      // An initial run is pointless once a dossier exists; a re-score is the point.
      const rescore = item.reason === "rescore";
      if (!a || (a.ai_fit_analysis && !rescore) || ["rejected", "withdrawn"].includes(String(a.status ?? "").toLowerCase())) {
        await setRow(item.id, { status: "done" });
        continue;
      }
      // No description yet: wait for one, without spending an assessment.
      if (!hasDescription((a as any).jobs?.description)) {
        await setRow(item.id, { status: "waiting", last_error: null });
        continue;
      }
      const attempts = item.attempts + 1;
      const res = await fetch(`${URL_}/functions/v1/analyze-candidate-fit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ candidate_id: a.candidate_id, job_id: a.job_id, trigger: rescore ? "scorecard" : "queue" }),
      }).catch(() => null);
      processed++;
      const outcome = outcomeOf(res?.status ?? 0, res ? await res.text() : "");

      if (outcome.kind === "pause") {
        await setRow(item.id, { last_error: outcome.reason });
        await pause(outcome.reason);
        return json(200, { paused: outcome.reason });
      }
      if (outcome.kind === "done") await setRow(item.id, { status: "done", attempts, last_error: null });
      else if (outcome.kind === "waiting") await setRow(item.id, { status: "waiting", attempts, last_error: null });
      else if (outcome.kind === "retry" && attempts < MAX_ATTEMPTS) {
        rateLimited = outcome.rateLimited;
        const wait = outcome.rateLimited ? 10 * 60_000 : attempts * 2 * 60_000;
        await setRow(item.id, { attempts, next_attempt_at: new Date(Date.now() + wait).toISOString(), last_error: outcome.error });
      } else {
        await setRow(item.id, { status: "failed", attempts, last_error: outcome.kind === "failed" || outcome.kind === "retry" ? outcome.error : null });
      }
    }
  } finally {
    await release();
  }

  // The next run, while due work remains (a rate limit waits for the sweep).
  const { count } = await sb.from("fit_analysis_queue").select("id", { count: "exact", head: true })
    .eq("status", "pending").lte("next_attempt_at", now());
  if ((count ?? 0) > 0 && hops > 0 && !rateLimited) {
    const next = new Promise((r) => setTimeout(r, HOP_DELAY_MS)).then(() => fetch(`${URL_}/functions/v1/process-fit-queue`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ hops: hops - 1 }),
    })).catch((e) => console.error("[process-fit-queue] next hop failed", e));
    // @ts-ignore EdgeRuntime is provided by Supabase
    EdgeRuntime.waitUntil(next);
  }
  return json(200, { processed, remaining_due: count ?? 0 });
});
