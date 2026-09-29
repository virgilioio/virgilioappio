// Prepares Gio Fit dossiers for candidates on live client pipelines.
// Woken on enqueue (DB trigger) and when a client opens a candidate that is
// still being prepared. Bounded: one lease holder, ≤5 items per run, a small
// hop budget, and it stops as soon as nothing is due.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const BATCH = 5;
const MAX_ATTEMPTS = 4;
const HOP_DELAY_MS = 15_000;
const LEASE_SECONDS = 240;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const hops = Math.max(0, Math.min(10, Number(body?.hops ?? 10)));

  const sb = createClient(URL_, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: got } = await sb.rpc("fit_queue_acquire_lease", { _seconds: LEASE_SECONDS });
  if (!got) return json(200, { skipped: "busy_or_paused" });

  const release = () => sb.from("fit_analysis_queue_control").update({ lease_until: null, updated_at: new Date().toISOString() }).eq("id", 1);
  const pause = (reason: string) => sb.from("fit_analysis_queue_control")
    .update({ paused_reason: reason, paused_at: new Date().toISOString(), lease_until: null }).eq("id", 1);

  let processed = 0;
  let rateLimited = 0;
  try {
    const { data: items } = await sb.from("fit_analysis_queue").select("id, association_id, attempts")
      .eq("status", "pending").lte("next_attempt_at", new Date().toISOString())
      .order("created_at").limit(BATCH);

    for (const item of items ?? []) {
      const { data: a } = await sb.from("job_candidate_associations")
        .select("candidate_id, job_id, status, ai_fit_analysis").eq("id", item.association_id).maybeSingle();
      if (!a || a.ai_fit_analysis || ["rejected", "withdrawn"].includes(String(a.status ?? "").toLowerCase())) {
        await sb.from("fit_analysis_queue").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", item.id);
        continue;
      }
      const attempts = item.attempts + 1;
      const res = await fetch(`${URL_}/functions/v1/analyze-candidate-fit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ candidate_id: a.candidate_id, job_id: a.job_id }),
      }).catch(() => null);
      processed++;
      const status = res?.status ?? 0;
      const text = res ? (await res.text()).slice(0, 300) : "network_error";

      if (status === 402 || status === 403) {
        await sb.from("fit_analysis_queue").update({ last_error: text, updated_at: new Date().toISOString() }).eq("id", item.id);
        await pause(`ai_${status}`);
        return json(200, { paused: status });
      }
      const retry = status === 202 || status === 429 || status === 0 || status >= 500;
      if (status === 429 && ++rateLimited >= 2) {
        await sb.from("fit_analysis_queue").update({ attempts, next_attempt_at: new Date(Date.now() + 10 * 60_000).toISOString(), last_error: text }).eq("id", item.id);
        break;
      }
      const update = res?.ok && status === 200
        ? { status: "done", attempts, last_error: null }
        : retry && attempts < MAX_ATTEMPTS
        ? { attempts, next_attempt_at: new Date(Date.now() + attempts * 2 * 60_000).toISOString(), last_error: text }
        : { status: "failed", attempts, last_error: text };
      await sb.from("fit_analysis_queue").update({ ...update, updated_at: new Date().toISOString() }).eq("id", item.id);
    }
  } finally {
    await release();
  }

  // Next hop only while due work remains, after a cooldown, within budget.
  const { count } = await sb.from("fit_analysis_queue").select("id", { count: "exact", head: true })
    .eq("status", "pending").lte("next_attempt_at", new Date().toISOString());
  if ((count ?? 0) > 0 && hops > 0 && rateLimited < 2) {
    const next = new Promise((r) => setTimeout(r, HOP_DELAY_MS)).then(() => fetch(`${URL_}/functions/v1/process-fit-queue`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ hops: hops - 1 }),
    })).catch((e) => console.error("[process-fit-queue] next hop failed", e));
    // @ts-ignore EdgeRuntime is provided by Supabase
    EdgeRuntime.waitUntil(next);
  }
  return json(200, { processed, remaining_due: count ?? 0 });
});
