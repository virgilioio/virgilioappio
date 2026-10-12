/**
 * Talent pool builder (Find Phase 2, 2026-10-12).
 *
 * Spends Apollo credits that active searches don't need on new people from
 * the workspace's pool searches, so the next search starts from our own
 * database. Runs hourly from pg_cron (13:00–22:00 UTC); each run spends at
 * most its share of the day's budget.
 *
 * Budget: credits left, minus a 1,000 reserve for real searches (released in
 * the last 3 days of the cycle), shared evenly across the days to renewal.
 * Rules:
 * - Search is free and the duplicate check is free: only people new to us
 *   are considered (Apollo id not in person_identities, not already in the
 *   project).
 * - The rule-based fit score ranks them; below 55 is skipped.
 * - At most 25 people per company per cycle.
 * - Collect without the phone (1 credit each), through enrich-apollo-profile,
 *   so the match finder, ledger and project state work exactly as for people.
 * - Stops when a recruiter has collected 10+ people in the last hour.
 * - Monday morning: one summary notification to the workspace's admins.
 *
 * Auth: the x-pool-secret header (checked against Vault) or the service key.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { isServiceCall } from "../_shared/caller.ts";
import { creditStatus } from "../_shared/apolloCredits.ts";
import { parseLocations, candidateSeniorities, targetCompanies, fitScore, normKey } from "../_shared/findCriteria.ts";

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const POOL_NOTE = 'Talent pool';
const COMPANY_CAP = 25;
const MIN_FIT = 55;
const PER_RUN_CAP = 60;          // people per run; ~10 runs a day
const COLLECT_CHUNK = 20;        // people per call to enrich-apollo-profile
const BUSY_PEOPLE = 10;          // a recruiter collect this big pauses the pool
const PREVIEWS_PER_SOURCE = 500;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function authorised(req: Request): Promise<boolean> {
  if (isServiceCall(req)) return true;
  const key = req.headers.get('x-pool-secret') ?? '';
  if (key.length < 32) return false;
  const { data, error } = await admin.rpc('pool_builder_secret_matches', { p_secret: key });
  return !error && data === true;
}

async function pagedValues(query: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** A recruiter collected 10+ people in the last hour: leave the credits to them. */
async function recruiterBusy(tenantId: string): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from('apollo_credit_ledger')
    .select('people, note')
    .eq('tenant_id', tenantId)
    .in('kind', ['collect', 'phone'])
    .gte('created_at', since);
  const people = (data ?? []).filter((r: any) => r.note !== POOL_NOTE).reduce((n: number, r: any) => n + (r.people ?? 0), 0);
  return people >= BUSY_PEOPLE;
}

interface SourceReport {
  project_id: string;
  name: string;
  previews: number;
  eligible: number;
  picked: number;
  collected: number;
  merged: number;
  credits: number;
  error?: string;
}

async function runTenant(tenantId: string, opts: { dryRun: boolean; maxPeople: number }) {
  const status = await creditStatus(admin, tenantId);
  if (!status.configured || !status.cycle_end) return { tenantId, skipped: 'Apollo credits are not set up' };

  const now = new Date();
  const cycleEnd = new Date(status.cycle_end);
  const daysLeft = Math.max(1, Math.ceil((cycleEnd.getTime() - now.getTime()) / 86_400_000));
  const finalDays = daysLeft <= 3;
  const reserve = finalDays ? 0 : status.reserve_credits;

  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const { data: todayRows } = await admin
    .from('apollo_credit_ledger')
    .select('credits')
    .eq('tenant_id', tenantId)
    .eq('note', POOL_NOTE)
    .gte('created_at', dayStart);
  const spentToday = (todayRows ?? []).reduce((n: number, r: any) => n + (r.credits ?? 0), 0);
  const budgetToday = Math.max(0, Math.floor((status.remaining + spentToday - reserve) / daysLeft));
  let allowance = Math.max(0, Math.min(budgetToday - spentToday, opts.maxPeople, status.remaining - reserve));

  const run = {
    tenant_id: tenantId,
    cycle_end: status.cycle_end,
    credits_remaining: status.remaining,
    reserve_applied: reserve,
    budget_today: budgetToday,
    spent_before: spentToday,
    searched: 0,
    new_people: 0,
    collected: 0,
    merged: 0,
    skipped_company_cap: 0,
    credits_used: 0,
    stopped_reason: null as string | null,
    dry_run: opts.dryRun,
    details: { sources: [] as SourceReport[], days_left: daysLeft } as Record<string, unknown>,
  };
  const sources = run.details.sources as SourceReport[];

  if (allowance <= 0) run.stopped_reason = budgetToday <= spentToday ? "Today's pool budget is spent" : 'No credits above the reserve';
  else if (await recruiterBusy(tenantId)) { run.stopped_reason = 'A recruiter is collecting; the pool waits'; allowance = 0; }

  // ── Where to look: pool searches, plus searches linked to open jobs ──
  let projects: any[] = [];
  if (allowance > 0) {
    const { data: rows, error } = await admin
      .from('sourcing_projects')
      .select('id, name, organization_id, created_by, search_criteria, pool_enabled, job_id, jobs(status), organizations!inner(tenant_id)')
      .eq('organizations.tenant_id', tenantId)
      .eq('status', 'active');
    if (error) throw error;
    projects = (rows ?? []).filter((p: any) =>
      (p.pool_enabled || p.jobs?.status === 'open') && (p.search_criteria?.title_keywords?.length ?? 0) > 0);
    if (projects.length === 0) { run.stopped_reason = 'No pool searches'; allowance = 0; }
    // A different search goes first each day.
    const day = Math.floor(now.getTime() / 86_400_000);
    projects = projects.map((p, i) => ({ p, k: (i + day) % Math.max(1, projects.length) })).sort((a, b) => a.k - b.k).map((x) => x.p);
  }

  // ── Who we already have, and how many per company this cycle ──
  const known = new Set<string>();
  const perCompany = new Map<string, number>();
  if (allowance > 0) {
    const ids = await pagedValues((from, to) => admin
      .from('person_identities').select('value').eq('tenant_id', tenantId).eq('kind', 'apollo').range(from, to));
    for (const r of ids) known.add(r.value);
    const poolRows = await pagedValues((from, to) => admin
      .from('sourcing_project_candidates').select('candidate_id')
      .eq('tenant_id', tenantId).eq('added_by_pool', true)
      .gte('collected_at', status.cycle_start!).not('candidate_id', 'is', null).range(from, to));
    const candIds = poolRows.map((r) => r.candidate_id);
    for (let i = 0; i < candIds.length; i += 200) {
      const { data } = await admin.from('candidates').select('company_current').in('id', candIds.slice(i, i + 200));
      for (const c of data ?? []) {
        const k = normKey(c.company_current);
        if (k) perCompany.set(k, (perCompany.get(k) ?? 0) + 1);
      }
    }
  }

  let left = allowance;
  for (let i = 0; i < projects.length && left > 0; i++) {
    const p = projects[i];
    const share = Math.ceil(left / (projects.length - i));
    const report: SourceReport = { project_id: p.id, name: p.name, previews: 0, eligible: 0, picked: 0, collected: 0, merged: 0, credits: 0 };
    sources.push(report);
    try {
      const { data: search, error: searchError } = await admin.functions.invoke('search-apollo-candidates', {
        body: { project_id: p.id, criteria: p.search_criteria, max_results: PREVIEWS_PER_SOURCE, organization_id: p.organization_id },
      });
      if (searchError) throw new Error(`search failed: ${searchError.message}`);
      const previews: any[] = search?.candidates ?? [];
      report.previews = previews.length;
      run.searched += previews.length;

      const { data: stateRows } = await admin
        .from('sourcing_project_candidates').select('apollo_id').eq('sourcing_project_id', p.id).not('apollo_id', 'is', null);
      const inProject = new Set((stateRows ?? []).map((r: any) => r.apollo_id));

      const criteria = p.search_criteria ?? {};
      const loc = parseLocations(criteria.locations);
      const seniorities = candidateSeniorities(criteria.seniorities);
      const companies = targetCompanies(criteria);
      const fresh = previews
        .filter((c) => c.apollo_id && !known.has(c.apollo_id) && !inProject.has(c.apollo_id))
        .map((c) => ({
          c,
          fit: fitScore({
            title: c.current_title || c.headline,
            company: c.current_company,
            // Apollo already applied the location and seniority filters.
            country: loc.countries[0] ?? null,
            city: loc.cities[0] ?? null,
            seniority: seniorities[0] ?? null,
            text: c.headline,
          }, criteria, loc, seniorities, companies),
        }))
        .filter((x) => x.fit.score >= MIN_FIT)
        .sort((a, b) => b.fit.score - a.fit.score);
      report.eligible = fresh.length;
      run.new_people += fresh.length;

      const picked: string[] = [];
      for (const { c } of fresh) {
        if (picked.length >= share) break;
        const k = normKey(c.current_company);
        if (k && (perCompany.get(k) ?? 0) >= COMPANY_CAP) { run.skipped_company_cap++; continue; }
        picked.push(c.apollo_id);
        known.add(c.apollo_id);
        if (k) perCompany.set(k, (perCompany.get(k) ?? 0) + 1);
      }
      report.picked = picked.length;
      if (opts.dryRun || picked.length === 0) continue;

      for (let j = 0; j < picked.length; j += COLLECT_CHUNK) {
        if (await recruiterBusy(tenantId)) { run.stopped_reason = 'A recruiter started collecting; the pool stopped'; left = 0; break; }
        const chunk = picked.slice(j, j + COLLECT_CHUNK);
        const { data: res, error: collectError } = await admin.functions.invoke('enrich-apollo-profile', {
          body: { apollo_ids: chunk, sourcing_project_id: p.id, pool: true },
        });
        if (collectError) { report.error = `collect failed: ${collectError.message}`; break; }
        const used = res?.credits_used ?? 0;
        report.collected += res?.enriched_count ?? 0;
        report.merged += res?.merged_count ?? 0;
        report.credits += used;
        run.credits_used += used;
        left -= used;
        if (res?.error_code === 'CREDITS_EXHAUSTED') { run.stopped_reason = 'Apollo credits ran out'; left = 0; break; }
      }
      run.collected += report.collected;
      run.merged += report.merged;
    } catch (err) {
      report.error = err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300);
    }
  }
  if (!run.stopped_reason && allowance > 0 && left > 0 && !opts.dryRun) run.stopped_reason = 'No more new people above the fit bar';

  const { data: saved, error: saveError } = await admin.from('talent_pool_runs').insert(run).select('id').single();
  if (saveError) console.error('talent_pool_runs insert failed:', saveError.message);

  const summary = opts.dryRun ? null : await maybeWeeklySummary(admin, tenantId, saved?.id ?? null, status.remaining - run.credits_used, cycleEnd);
  return { tenantId, run, summary };
}

/** Monday from 9:00 in Guadalajara: one line to each admin about the week's pool. */
async function maybeWeeklySummary(db: SupabaseClient, tenantId: string, runId: string | null, creditsLeft: number, cycleEnd: Date) {
  const local = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  if (local.getDay() !== 1 || local.getHours() < 9 || !runId) return null;
  const weekAgo = new Date(Date.now() - 6 * 86_400_000).toISOString();
  const { data: sent } = await db.from('talent_pool_runs').select('id')
    .eq('tenant_id', tenantId).eq('summary_sent', true).gte('ran_at', weekAgo).limit(1);
  if ((sent ?? []).length > 0) return null;

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: runs } = await db.from('talent_pool_runs').select('collected, merged, credits_used, details')
    .eq('tenant_id', tenantId).eq('dry_run', false).gte('ran_at', since);
  const added = (runs ?? []).reduce((n: number, r: any) => n + (r.collected ?? 0), 0);
  const byName = new Map<string, number>();
  for (const r of runs ?? []) for (const s of (r.details?.sources ?? [])) {
    if (s.collected) byName.set(s.name, (byName.get(s.name) ?? 0) + s.collected);
  }
  const top = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([n, c]) => `${n.replace(/^Talent pool · /, '')} ${c}`).join(', ');
  const renews = cycleEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const title = added > 0
    ? `Added ${added.toLocaleString('en-US')} ${added === 1 ? 'person' : 'people'} to the talent pool this week`
    : 'The talent pool added no one this week';
  const subtitle = `${top ? `${top} · ` : ''}${Math.max(0, creditsLeft).toLocaleString('en-US')} credits left, renewing ${renews}`;

  const { data: admins } = await db.from('members').select('user_id')
    .eq('tenant_id', tenantId).eq('user_status', 'active').eq('system_role', 'admin');
  const rows = (admins ?? []).filter((a: any) => a.user_id).map((a: any) => ({
    user_id: a.user_id,
    tenant_id: tenantId,
    category: 'talent_pool',
    title,
    subtitle,
    entity_kind: 'talent_pool',
    action_url: '/find',
    metadata: { added, credits_left: creditsLeft },
  }));
  if (rows.length > 0) {
    const { error } = await db.from('notifications').insert(rows);
    if (error) { console.error('Pool summary notification failed:', error.message); return null; }
  }
  await db.from('talent_pool_runs').update({ summary_sent: true }).eq('id', runId);
  return { title, subtitle, recipients: rows.length };
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  if (!(await authorised(req))) return json({ error: 'Not allowed' }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const dryRun = body.dry_run === true;
  const maxPeople = Math.max(0, Math.min(Number(body.max_people) || PER_RUN_CAP, PER_RUN_CAP));

  try {
    const { data: plans, error } = await admin.from('apollo_credit_plans').select('tenant_id');
    if (error) throw error;
    const tenants = (plans ?? []).map((p: any) => p.tenant_id)
      .filter((t: string) => !body.tenant_id || t === body.tenant_id);
    const results = [];
    for (const t of tenants) results.push(await runTenant(t, { dryRun, maxPeople }));
    return json({ ok: true, results });
  } catch (err) {
    console.error('pool-builder failed:', err);
    return json({ error: "The pool builder couldn't run" }, 500);
  }
});
